import { query } from '../config/db.js';
import { jsonToCsv } from '../utils/csv.js';

export async function generateReport({ type = 'stock', format = 'json', dateFrom, dateTo, warehouseId, productId }) {
  let data = [];
  let columns = [];
  let filename = `stocksphere-${type}-report-${new Date().toISOString().split('T')[0]}`;

  const params = [];
  const conditions = [];

  if (warehouseId) {
    params.push(warehouseId);
    conditions.push(`b.warehouse_id = $${params.length}`);
  }
  if (productId) {
    params.push(productId);
    conditions.push(`p.id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  switch (type) {
    case 'stock':
    case 'valuation': {
      columns = [
        { label: 'SKU', key: 'sku' },
        { label: 'Product Name', key: 'name' },
        { label: 'Category', key: 'category_name' },
        { label: 'Unit', key: 'unit' },
        { label: 'Total Quantity', key: 'total_stock' },
        { label: 'Cost Price ($)', key: 'cost_price' },
        { label: 'Selling Price ($)', key: 'selling_price' },
        { label: 'Inventory Valuation ($)', key: 'inventory_value' },
        { label: 'Stock Status', key: 'stock_status' },
      ];

      const res = await query(`
        SELECT 
          p.sku,
          p.name,
          COALESCE(c.name, 'Uncategorized') AS category_name,
          p.unit,
          COALESCE(SUM(b.quantity), 0)::INT AS total_stock,
          p.cost_price,
          p.selling_price,
          ROUND((COALESCE(SUM(b.quantity), 0) * p.cost_price)::NUMERIC, 2) AS inventory_value,
          CASE
            WHEN COALESCE(SUM(b.quantity), 0) = 0 THEN 'OUT_OF_STOCK'
            WHEN COALESCE(SUM(b.quantity), 0) <= p.reorder_level THEN 'LOW_STOCK'
            ELSE 'IN_STOCK'
          END AS stock_status
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN stock_balances b ON p.id = b.product_id
        ${whereClause}
        GROUP BY p.id, c.name
        ORDER BY p.name ASC
      `, params);
      data = res.rows;
      break;
    }

    case 'low-stock': {
      columns = [
        { label: 'SKU', key: 'sku' },
        { label: 'Product Name', key: 'name' },
        { label: 'Unit', key: 'unit' },
        { label: 'Current Stock', key: 'total_stock' },
        { label: 'Reorder Level', key: 'reorder_level' },
        { label: 'Suggested Replenishment', key: 'suggested_replenishment' },
        { label: 'Stock Deficit', key: 'deficit' },
      ];

      const res = await query(`
        SELECT 
          p.sku,
          p.name,
          p.unit,
          COALESCE(SUM(b.quantity), 0)::INT AS total_stock,
          p.reorder_level,
          GREATEST(p.reorder_level * 2 - COALESCE(SUM(b.quantity), 0), 0)::INT AS suggested_replenishment,
          GREATEST(p.reorder_level - COALESCE(SUM(b.quantity), 0), 0)::INT AS deficit
        FROM products p
        LEFT JOIN stock_balances b ON p.id = b.product_id
        ${whereClause}
        GROUP BY p.id
        HAVING COALESCE(SUM(b.quantity), 0) <= p.reorder_level
        ORDER BY total_stock ASC
      `, params);
      data = res.rows;
      break;
    }

    case 'warehouse-stock': {
      columns = [
        { label: 'Warehouse Code', key: 'warehouse_code' },
        { label: 'Warehouse Name', key: 'warehouse_name' },
        { label: 'Location', key: 'location' },
        { label: 'Stored Products', key: 'active_product_count' },
        { label: 'Total Units', key: 'total_stock' },
        { label: 'Total Valuation ($)', key: 'total_valuation' },
      ];

      const res = await query(`
        SELECT 
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          w.location,
          COALESCE(COUNT(DISTINCT b.product_id) FILTER (WHERE b.quantity > 0), 0)::INT AS active_product_count,
          COALESCE(SUM(b.quantity), 0)::INT AS total_stock,
          ROUND(COALESCE(SUM(b.quantity * pr.cost_price), 0)::NUMERIC, 2) AS total_valuation
        FROM warehouses w
        LEFT JOIN stock_balances b ON w.id = b.warehouse_id
        LEFT JOIN products pr ON b.product_id = pr.id
        GROUP BY w.id, w.code, w.name, w.location
        ORDER BY w.name ASC
      `);
      data = res.rows;
      break;
    }

    case 'movements':
    case 'stock-in':
    case 'stock-out':
    case 'adjustments': {
      let filterType = null;
      if (type === 'stock-in') filterType = 'IN';
      if (type === 'stock-out') filterType = 'OUT';
      if (type === 'adjustments') filterType = 'ADJUSTMENT';

      const movConditions = [];
      const movParams = [];

      if (filterType) {
        movParams.push(filterType);
        movConditions.push(`m.type = $${movParams.length}`);
      }
      if (dateFrom) {
        movParams.push(dateFrom);
        movConditions.push(`m.created_at >= $${movParams.length}`);
      }
      if (dateTo) {
        movParams.push(dateTo);
        movConditions.push(`m.created_at <= $${movParams.length}`);
      }
      if (warehouseId) {
        movParams.push(warehouseId);
        movConditions.push(`m.warehouse_id = $${movParams.length}`);
      }

      const movWhere = movConditions.length > 0 ? `WHERE ${movConditions.join(' AND ')}` : '';

      columns = [
        { label: 'Timestamp', key: 'created_at' },
        { label: 'Type', key: 'type' },
        { label: 'SKU', key: 'sku' },
        { label: 'Product Name', key: 'product_name' },
        { label: 'Warehouse', key: 'warehouse_name' },
        { label: 'Quantity Change', key: 'quantity_change' },
        { label: 'Balance After', key: 'balance_after' },
        { label: 'Unit Cost ($)', key: 'unit_cost' },
        { label: 'Reference', key: 'reference_no' },
        { label: 'Reason', key: 'reason' },
        { label: 'User', key: 'user_name' },
      ];

      const res = await query(`
        SELECT 
          m.created_at,
          m.type,
          p.sku,
          p.name AS product_name,
          w.name AS warehouse_name,
          m.quantity_change,
          m.balance_after,
          m.unit_cost,
          m.reference_no,
          m.reason,
          COALESCE(u.full_name, 'System') AS user_name
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.id
        JOIN warehouses w ON m.warehouse_id = w.id
        LEFT JOIN users u ON m.user_id = u.id
        ${movWhere}
        ORDER BY m.created_at DESC
        LIMIT 1000
      `, movParams);
      data = res.rows;
      break;
    }

    default:
      throw new Error(`Unsupported report type '${type}'`);
  }

  if (format === 'csv') {
    const csvContent = jsonToCsv(data, columns);
    return { format: 'csv', content: csvContent, filename: `${filename}.csv` };
  }

  return { format: 'json', type, total: data.length, columns, data };
}
