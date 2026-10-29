import { query } from '../config/db.js';

export async function getBalance(productId, warehouseId, client = null) {
  const runner = client || { query };
  const res = await runner.query(`
    SELECT product_id, warehouse_id, quantity, updated_at
    FROM stock_balances
    WHERE product_id = $1 AND warehouse_id = $2
  `, [productId, warehouseId]);
  return res.rows[0] || null;
}

export async function lockBalance(client, productId, warehouseId) {
  // Lock single balance row for update
  const res = await client.query(`
    SELECT product_id, warehouse_id, quantity
    FROM stock_balances
    WHERE product_id = $1 AND warehouse_id = $2
    FOR UPDATE
  `, [productId, warehouseId]);
  return res.rows[0] || null;
}

export async function upsertStockIn(client, productId, warehouseId, quantity) {
  const res = await client.query(`
    INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET quantity = stock_balances.quantity + $3,
                  updated_at = CURRENT_TIMESTAMP
    RETURNING quantity;
  `, [productId, warehouseId, quantity]);
  return res.rows[0].quantity;
}

export async function updateStockOut(client, productId, warehouseId, quantity) {
  const res = await client.query(`
    UPDATE stock_balances
    SET quantity = quantity - $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE product_id = $1 AND warehouse_id = $2 AND quantity >= $3
    RETURNING quantity;
  `, [productId, warehouseId, quantity]);
  
  if (res.rowCount === 0 || res.rows.length === 0) {
    return null;
  }
  return res.rows[0].quantity;
}

export async function setBalance(client, productId, warehouseId, newQuantity) {
  const res = await client.query(`
    INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET quantity = $3,
                  updated_at = CURRENT_TIMESTAMP
    RETURNING quantity;
  `, [productId, warehouseId, newQuantity]);
  return res.rows[0].quantity;
}

export async function listBalances({ productId = null, warehouseId = null, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const params = [];
  const where = [];

  if (productId) {
    params.push(productId);
    where.push(`b.product_id = $${params.length}`);
  }
  if (warehouseId) {
    params.push(warehouseId);
    where.push(`b.warehouse_id = $${params.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await query(`
    SELECT COUNT(*) FROM stock_balances b ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const res = await query(`
    SELECT 
      b.product_id,
      p.sku,
      p.name AS product_name,
      p.unit,
      p.cost_price,
      p.selling_price,
      p.reorder_level,
      b.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      b.quantity,
      ROUND((b.quantity * p.cost_price)::NUMERIC, 2) AS valuation,
      b.updated_at
    FROM stock_balances b
    JOIN products p ON b.product_id = p.id
    JOIN warehouses w ON b.warehouse_id = w.id
    ${whereClause}
    ORDER BY p.name ASC, w.name ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `, params);

  return {
    data: res.rows,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  };
}
