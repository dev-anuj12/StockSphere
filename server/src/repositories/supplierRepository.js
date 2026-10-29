import { query } from '../config/db.js';

export async function listSuppliers(status = 'active') {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE s.status = $1`;
  }

  const res = await query(`
    SELECT 
      s.*,
      COUNT(p.id)::INT AS product_count
    FROM suppliers s
    LEFT JOIN products p ON s.id = p.supplier_id AND p.status = 'active'
    ${where}
    GROUP BY s.id
    ORDER BY s.name ASC
  `, params);

  return res.rows;
}

export async function findById(id) {
  const res = await query(`
    SELECT s.*, COUNT(p.id)::INT AS product_count
    FROM suppliers s
    LEFT JOIN products p ON s.id = p.supplier_id AND p.status = 'active'
    WHERE s.id = $1
    GROUP BY s.id
  `, [id]);
  return res.rows[0] || null;
}

export async function findByCode(code) {
  const res = await query(`SELECT * FROM suppliers WHERE UPPER(code) = UPPER($1)`, [code.trim()]);
  return res.rows[0] || null;
}

export async function createSupplier({ name, code, contact_name, email, phone, address, status = 'active' }) {
  const res = await query(`
    INSERT INTO suppliers (name, code, contact_name, email, phone, address, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [name.trim(), code.trim().toUpperCase(), contact_name || null, email || null, phone || null, address || null, status]);
  return res.rows[0];
}

export async function updateSupplier(id, updates) {
  const fields = [];
  const values = [];

  const allowed = ['name', 'code', 'contact_name', 'email', 'phone', 'address', 'status'];
  for (const [k, v] of Object.entries(updates)) {
    if (allowed.includes(k) && v !== undefined) {
      values.push(k === 'code' ? v.trim().toUpperCase() : v);
      fields.push(`${k} = $${values.length}`);
    }
  }

  if (fields.length === 0) return await findById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const res = await query(`
    UPDATE suppliers SET ${fields.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `, values);

  return res.rows[0];
}
