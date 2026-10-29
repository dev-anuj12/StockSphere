import { query } from '../config/db.js';

export async function listCategories() {
  const res = await query(`
    SELECT c.*, p.name AS parent_name,
           (SELECT COUNT(*) FROM products pr WHERE pr.category_id = c.id AND pr.status = 'active')::INT AS product_count
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.id
    ORDER BY c.name ASC
  `);
  return res.rows;
}

export async function findById(id) {
  const res = await query(`
    SELECT c.*, p.name AS parent_name
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE c.id = $1
  `, [id]);
  return res.rows[0] || null;
}

export async function findByCode(code) {
  const res = await query(`SELECT * FROM categories WHERE UPPER(code) = UPPER($1)`, [code.trim()]);
  return res.rows[0] || null;
}

export async function createCategory({ name, code, description, parent_id }) {
  const res = await query(`
    INSERT INTO categories (name, code, description, parent_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [name.trim(), code.trim().toUpperCase(), description || null, parent_id || null]);
  return res.rows[0];
}

export async function updateCategory(id, { name, code, description, parent_id }) {
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
  if (description !== undefined) {
    values.push(description);
    fields.push(`description = $${values.length}`);
  }
  if (parent_id !== undefined) {
    values.push(parent_id);
    fields.push(`parent_id = $${values.length}`);
  }

  if (fields.length === 0) return await findById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const res = await query(`
    UPDATE categories SET ${fields.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `, values);

  return res.rows[0];
}

export async function hasProducts(id) {
  const res = await query(`SELECT 1 FROM products WHERE category_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function deleteCategory(id) {
  const res = await query(`DELETE FROM categories WHERE id = $1 RETURNING id`, [id]);
  return res.rows[0];
}
