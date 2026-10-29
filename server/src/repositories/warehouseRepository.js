import { query } from '../config/db.js';

export async function listWarehouses(status = 'active') {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE w.status = $1`;
  }

  const res = await query(`
    SELECT 
      w.*,
      p.name AS parent_name,
      COALESCE(SUM(b.quantity), 0)::INT AS total_stock,
      COALESCE(COUNT(DISTINCT b.product_id) FILTER (WHERE b.quantity > 0), 0)::INT AS active_product_count,
      ROUND(COALESCE(SUM(b.quantity * pr.cost_price), 0)::NUMERIC, 2) AS total_valuation
    FROM warehouses w
    LEFT JOIN warehouses p ON w.parent_id = p.id
    LEFT JOIN stock_balances b ON w.id = b.warehouse_id
    LEFT JOIN products pr ON b.product_id = pr.id
    ${where}
    GROUP BY w.id, p.name
    ORDER BY w.name ASC
  `, params);

  return res.rows;
}

export async function findById(id) {
  const res = await query(`
    SELECT 
      w.*,
      p.name AS parent_name,
      COALESCE(SUM(b.quantity), 0)::INT AS total_stock,
      COALESCE(COUNT(DISTINCT b.product_id) FILTER (WHERE b.quantity > 0), 0)::INT AS active_product_count,
      ROUND(COALESCE(SUM(b.quantity * pr.cost_price), 0)::NUMERIC, 2) AS total_valuation
    FROM warehouses w
    LEFT JOIN warehouses p ON w.parent_id = p.id
    LEFT JOIN stock_balances b ON w.id = b.warehouse_id
    LEFT JOIN products pr ON b.product_id = pr.id
    WHERE w.id = $1
    GROUP BY w.id, p.name
  `, [id]);

  if (res.rows.length === 0) return null;
  const warehouse = res.rows[0];

  // Fetch stored products in this warehouse
  const prodRes = await query(`
    SELECT 
      p.id AS product_id,
      p.sku,
      p.name AS product_name,
      p.unit,
      p.cost_price,
      p.selling_price,
      p.reorder_level,
      b.quantity,
      ROUND((b.quantity * p.cost_price)::NUMERIC, 2) AS valuation,
      b.updated_at
    FROM stock_balances b
    JOIN products p ON b.product_id = p.id
    WHERE b.warehouse_id = $1 AND b.quantity > 0
    ORDER BY p.name ASC
  `, [id]);

  warehouse.stored_products = prodRes.rows;
  return warehouse;
}

export async function findByCode(code) {
  const res = await query(`SELECT * FROM warehouses WHERE UPPER(code) = UPPER($1)`, [code.trim()]);
  return res.rows[0] || null;
}

export async function createWarehouse({ name, code, location, parent_id, status = 'active' }) {
  const res = await query(`
    INSERT INTO warehouses (name, code, location, parent_id, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [name.trim(), code.trim().toUpperCase(), location.trim(), parent_id || null, status]);
  return res.rows[0];
}

export async function updateWarehouse(id, { name, code, location, parent_id, status }) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    values.push(name.trim());
    fields.push(`name = $${values.length}`);
  }
  if (code !== undefined) {
    values.push(code.trim().toUpperCase());
    fields.push(`code = $${values.length}`);
  }
  if (location !== undefined) {
    values.push(location.trim());
    fields.push(`location = $${values.length}`);
  }
  if (parent_id !== undefined) {
    values.push(parent_id);
    fields.push(`parent_id = $${values.length}`);
  }
  if (status !== undefined) {
    values.push(status);
    fields.push(`status = $${values.length}`);
  }

  if (fields.length === 0) return await findById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const res = await query(`
    UPDATE warehouses SET ${fields.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `, values);

  return res.rows[0];
}
