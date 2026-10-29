import { query } from '../config/db.js';
import { MinHeap } from '../utils/minHeap.js';

export async function getStats(user) {
  // Total active products count
  const prodRes = await query(`SELECT COUNT(*) FROM products WHERE status = 'active'`);
  const totalProducts = parseInt(prodRes.rows[0].count, 10);

  // Total warehouses count
  const whRes = await query(`SELECT COUNT(*) FROM warehouses WHERE status = 'active'`);
  const totalWarehouses = parseInt(whRes.rows[0].count, 10);

  // Inventory valuation, low stock count, and out of stock count
  const stockSummaryRes = await query(`
    WITH product_totals AS (
      SELECT 
        p.id,
        p.reorder_level,
        p.cost_price,
        COALESCE(SUM(b.quantity), 0)::INT AS total_stock
      FROM products p
      LEFT JOIN stock_balances b ON p.id = b.product_id
      WHERE p.status = 'active'
      GROUP BY p.id, p.reorder_level, p.cost_price
    )
    SELECT 
      COALESCE(SUM(total_stock * cost_price), 0)::NUMERIC(12,2) AS total_valuation,
      COALESCE(SUM(total_stock), 0)::INT AS total_quantity,
      COUNT(*) FILTER (WHERE total_stock <= reorder_level AND total_stock > 0)::INT AS low_stock_count,
      COUNT(*) FILTER (WHERE total_stock = 0)::INT AS out_of_stock_count
    FROM product_totals
  `);

  const summary = stockSummaryRes.rows[0];

  return {
    total_products: totalProducts,
    total_warehouses: totalWarehouses,
    total_valuation: parseFloat(summary.total_valuation || 0),
    total_quantity: parseInt(summary.total_quantity || 0, 10),
    low_stock_count: parseInt(summary.low_stock_count || 0, 10),
    out_of_stock_count: parseInt(summary.out_of_stock_count || 0, 10),
  };
}

export async function getRecentMovements(user, limit = 8) {
  const params = [limit];
  let where = '';
  if (user && user.role === 'staff' && Array.isArray(user.warehouses)) {
    params.unshift(user.warehouses);
    where = `WHERE m.warehouse_id = ANY($1::uuid[])`;
    params[1] = limit;
  }

  const res = await query(`
    SELECT 
      m.id,
      m.type,
      m.quantity_change,
      m.balance_after,
      m.reference_no,
      m.reason,
      m.created_at,
      p.id AS product_id,
      p.sku AS product_sku,
      p.name AS product_name,
      p.unit,
      w.name AS warehouse_name,
      u.full_name AS user_name
    FROM inventory_movements m
    JOIN products p ON m.product_id = p.id
    JOIN warehouses w ON m.warehouse_id = w.id
    LEFT JOIN users u ON m.user_id = u.id
    ${where}
    ORDER BY m.created_at DESC
    LIMIT $${params.length}
  `, params);

  return res.rows;
}

export async function getLowStockAlerts(user, limit = 10) {
  // Query all active products with their current stock and reorder level
  const res = await query(`
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.unit,
      p.reorder_level,
      p.cost_price,
      c.name AS category_name,
      COALESCE(SUM(b.quantity), 0)::INT AS total_stock,
      CASE 
        WHEN COALESCE(SUM(b.quantity), 0) = 0 THEN 'OUT_OF_STOCK'
        ELSE 'LOW_STOCK'
      END AS status,
      GREATEST(p.reorder_level * 2 - COALESCE(SUM(b.quantity), 0), 0)::INT AS suggested_replenishment
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock_balances b ON p.id = b.product_id
    WHERE p.status = 'active'
    GROUP BY p.id, c.name
    HAVING COALESCE(SUM(b.quantity), 0) <= p.reorder_level
  `);

  // Min-Heap priority ordering by severity ratio: current_stock / reorder_level
  // Items with the lowest ratio (e.g. 0/40 = 0, 3/5 = 0.6) have highest urgency!
  const heap = new MinHeap((a, b) => {
    const ratioA = a.reorder_level > 0 ? a.total_stock / a.reorder_level : 0;
    const ratioB = b.reorder_level > 0 ? b.total_stock / b.reorder_level : 0;
    if (ratioA !== ratioB) return ratioA - ratioB;
    return a.total_stock - b.total_stock;
  });

  for (const item of res.rows) {
    heap.push(item);
  }

  const prioritized = [];
  while (!heap.isEmpty() && prioritized.length < limit) {
    prioritized.push(heap.pop());
  }

  return prioritized;
}

export async function getDashboardCharts(user) {
  // 1. Stock In vs Out by Day (last 14 days)
  const inOutRes = await query(`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
      COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity_change ELSE 0 END), 0)::INT AS stock_in,
      COALESCE(SUM(CASE WHEN type = 'OUT' THEN ABS(quantity_change) ELSE 0 END), 0)::INT AS stock_out
    FROM inventory_movements
    WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY date ASC
  `);

  // 2. Inventory by Warehouse
  const whRes = await query(`
    SELECT 
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      COALESCE(SUM(b.quantity), 0)::INT AS total_quantity,
      ROUND(COALESCE(SUM(b.quantity * p.cost_price), 0)::NUMERIC, 2) AS total_valuation
    FROM warehouses w
    LEFT JOIN stock_balances b ON w.id = b.warehouse_id
    LEFT JOIN products p ON b.product_id = p.id
    WHERE w.status = 'active'
    GROUP BY w.id, w.name, w.code
    ORDER BY total_quantity DESC
  `);

  // 3. Stock by Category
  const catRes = await query(`
    SELECT 
      COALESCE(c.name, 'Uncategorized') AS category_name,
      COUNT(DISTINCT p.id)::INT AS product_count,
      COALESCE(SUM(b.quantity), 0)::INT AS total_quantity,
      ROUND(COALESCE(SUM(b.quantity * p.cost_price), 0)::NUMERIC, 2) AS total_valuation
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock_balances b ON p.id = b.product_id
    WHERE p.status = 'active'
    GROUP BY c.name
    ORDER BY total_valuation DESC
  `);

  return {
    in_out_trend: inOutRes.rows,
    inventory_by_warehouse: whRes.rows,
    stock_by_category: catRes.rows,
  };
}
