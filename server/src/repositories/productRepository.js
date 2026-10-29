import { query } from '../config/db.js';

export async function listProducts({
  page = 1,
  limit = 10,
  sort = 'created_at',
  order = 'DESC',
  search = '',
  categoryId = null,
  supplierId = null,
  stockStatus = null,
  status = 'active'
}) {
  const offset = (page - 1) * limit;
  const validSorts = ['name', 'sku', 'cost_price', 'selling_price', 'reorder_level', 'total_stock', 'created_at'];
  const sortCol = validSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }

  if (categoryId) {
    params.push(categoryId);
    conditions.push(`p.category_id = $${params.length}`);
  }

  if (supplierId) {
    params.push(supplierId);
    conditions.push(`p.supplier_id = $${params.length}`);
  }

  if (search && search.trim() !== '') {
    params.push(`%${search.trim().toLowerCase()}%`);
    conditions.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Base CTE calculating total_stock and stock_status
  const baseSql = `
    WITH product_stock AS (
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.description,
        p.category_id,
        c.name AS category_name,
        p.supplier_id,
        s.name AS supplier_name,
        p.unit,
        p.cost_price,
        p.selling_price,
        p.reorder_level,
        p.status,
        p.archived_at,
        p.created_at,
        p.updated_at,
        COALESCE(SUM(b.quantity), 0)::INT AS total_stock,
        ROUND((COALESCE(SUM(b.quantity), 0) * p.cost_price)::NUMERIC, 2) AS inventory_value,
        CASE
          WHEN COALESCE(SUM(b.quantity), 0) = 0 THEN 'out_of_stock'
          WHEN COALESCE(SUM(b.quantity), 0) <= p.reorder_level THEN 'low_stock'
          ELSE 'in_stock'
        END AS stock_status,
        GREATEST(p.reorder_level * 2 - COALESCE(SUM(b.quantity), 0), 0)::INT AS suggested_replenishment
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stock_balances b ON p.id = b.product_id
      ${whereClause}
      GROUP BY p.id, c.name, s.name
    )
  `;

  let finalWhere = '';
  if (stockStatus) {
    params.push(stockStatus);
    finalWhere = `WHERE stock_status = $${params.length}`;
  }

  // Count query
  const countSql = `${baseSql} SELECT COUNT(*) FROM product_stock ${finalWhere}`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0].count, 10);

  // Pagination parameters
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const dataSql = `
    ${baseSql}
    SELECT * FROM product_stock
    ${finalWhere}
    ORDER BY ${sortCol === 'total_stock' ? 'total_stock' : sortCol} ${sortOrder}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const dataRes = await query(dataSql, params);

  return {
    data: dataRes.rows,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  };
}

export async function findById(id) {
  const prodRes = await query(`
    SELECT 
      p.*,
      c.name AS category_name,
      s.name AS supplier_name,
      COALESCE(SUM(b.quantity), 0)::INT AS total_stock,
      ROUND((COALESCE(SUM(b.quantity), 0) * p.cost_price)::NUMERIC, 2) AS inventory_value,
      CASE
        WHEN COALESCE(SUM(b.quantity), 0) = 0 THEN 'out_of_stock'
        WHEN COALESCE(SUM(b.quantity), 0) <= p.reorder_level THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status,
      GREATEST(p.reorder_level * 2 - COALESCE(SUM(b.quantity), 0), 0)::INT AS suggested_replenishment
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN stock_balances b ON p.id = b.product_id
    WHERE p.id = $1
    GROUP BY p.id, c.name, s.name
  `, [id]);

  if (prodRes.rows.length === 0) return null;
  const product = prodRes.rows[0];

  // Fetch per-warehouse stock
  const whStockRes = await query(`
    SELECT 
      w.id AS warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      w.location,
      COALESCE(b.quantity, 0)::INT AS quantity,
      b.updated_at
    FROM warehouses w
    LEFT JOIN stock_balances b ON w.id = b.warehouse_id AND b.product_id = $1
    WHERE w.status = 'active'
    ORDER BY w.name ASC
  `, [id]);
  product.warehouse_stocks = whStockRes.rows;

  // Fetch recent movements for this product
  const movRes = await query(`
    SELECT 
      m.id,
      m.type,
      m.quantity_change,
      m.balance_after,
      m.unit_cost,
      m.transfer_id,
      m.reference_no,
      m.reason,
      m.notes,
      m.created_at,
      w.name AS warehouse_name,
      u.full_name AS user_name
    FROM inventory_movements m
    JOIN warehouses w ON m.warehouse_id = w.id
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.product_id = $1
    ORDER BY m.created_at DESC
    LIMIT 20
  `, [id]);
  product.recent_movements = movRes.rows;

  return product;
}

export async function findBySku(sku) {
  const res = await query(`SELECT * FROM products WHERE UPPER(sku) = UPPER($1)`, [sku.trim()]);
  return res.rows[0] || null;
}

export async function createProduct({ sku, name, description, category_id, supplier_id, unit = 'pcs', cost_price, selling_price, reorder_level = 10 }) {
  const res = await query(`
    INSERT INTO products (sku, name, description, category_id, supplier_id, unit, cost_price, selling_price, reorder_level, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
    RETURNING *
  `, [sku.trim().toUpperCase(), name.trim(), description || null, category_id || null, supplier_id || null, unit, cost_price, selling_price, reorder_level]);
  return res.rows[0];
}

export async function updateProduct(id, updates) {
  const fields = [];
  const values = [];

  const allowed = ['name', 'description', 'category_id', 'supplier_id', 'unit', 'cost_price', 'selling_price', 'reorder_level', 'status'];
  for (const [key, val] of Object.entries(updates)) {
    if (allowed.includes(key) && val !== undefined) {
      values.push(val);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) return await findById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const res = await query(`
    UPDATE products SET ${fields.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `, values);

  return res.rows[0];
}

export async function hasMovementHistory(id) {
  const res = await query(`SELECT 1 FROM inventory_movements WHERE product_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function archiveProduct(id) {
  const res = await query(`
    UPDATE products
    SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [id]);
  return res.rows[0];
}

export async function hardDeleteProduct(id) {
  await query(`DELETE FROM stock_balances WHERE product_id = $1`, [id]);
  const res = await query(`DELETE FROM products WHERE id = $1 RETURNING id`, [id]);
  return res.rows[0];
}

export async function searchAutocomplete(q, limit = 10) {
  const res = await query(`
    SELECT p.id, p.sku, p.name, p.unit, p.cost_price, p.selling_price, p.reorder_level,
           COALESCE(SUM(b.quantity), 0)::INT AS total_stock
    FROM products p
    LEFT JOIN stock_balances b ON p.id = b.product_id
    WHERE p.status = 'active'
      AND (LOWER(p.name) LIKE $1 OR LOWER(p.sku) LIKE $1)
    GROUP BY p.id
    ORDER BY p.name ASC
    LIMIT $2
  `, [`%${q.toLowerCase()}%`, limit]);
  return res.rows;
}
