import { query } from '../config/db.js';

export async function insertMovement(client, {
  type,
  productId,
  warehouseId,
  quantityChange,
  balanceAfter,
  unitCost,
  transferId = null,
  reversalOf = null,
  referenceNo = null,
  reason = null,
  notes = null,
  userId = null,
}) {
  const runner = client || { query };
  const res = await runner.query(`
    INSERT INTO inventory_movements (
      type, product_id, warehouse_id, quantity_change, balance_after,
      unit_cost, transfer_id, reversal_of, reference_no, reason, notes, user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    type,
    productId,
    warehouseId,
    quantityChange,
    balanceAfter,
    unitCost,
    transferId,
    reversalOf,
    referenceNo,
    reason,
    notes,
    userId,
  ]);
  return res.rows[0];
}

export async function findById(id) {
  const res = await query(`
    SELECT 
      m.*,
      p.sku AS product_sku,
      p.name AS product_name,
      p.unit AS product_unit,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      u.full_name AS user_name,
      u.role AS user_role
    FROM inventory_movements m
    JOIN products p ON m.product_id = p.id
    JOIN warehouses w ON m.warehouse_id = w.id
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.id = $1
  `, [id]);
  return res.rows[0] || null;
}

export async function listMovements({
  page = 1,
  limit = 20,
  search = '',
  dateFrom = null,
  dateTo = null,
  productId = null,
  warehouseId = null,
  type = null,
  allowedWarehouses = null // For staff filtering
}) {
  const offset = (page - 1) * limit;
  const params = [];
  const where = [];

  if (productId) {
    params.push(productId);
    where.push(`m.product_id = $${params.length}`);
  }

  if (warehouseId) {
    params.push(warehouseId);
    where.push(`m.warehouse_id = $${params.length}`);
  }

  if (type) {
    params.push(type.toUpperCase());
    where.push(`m.type = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    where.push(`m.created_at >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    where.push(`m.created_at <= $${params.length}`);
  }

  if (allowedWarehouses && Array.isArray(allowedWarehouses)) {
    params.push(allowedWarehouses);
    where.push(`m.warehouse_id = ANY($${params.length}::uuid[])`);
  }

  if (search && search.trim() !== '') {
    params.push(`%${search.trim().toLowerCase()}%`);
    const pIdx = params.length;
    where.push(`(
      LOWER(p.name) LIKE $${pIdx} OR 
      LOWER(p.sku) LIKE $${pIdx} OR 
      LOWER(COALESCE(m.reference_no, '')) LIKE $${pIdx} OR 
      LOWER(COALESCE(m.reason, '')) LIKE $${pIdx}
    )`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await query(`
    SELECT COUNT(*) 
    FROM inventory_movements m
    JOIN products p ON m.product_id = p.id
    JOIN warehouses w ON m.warehouse_id = w.id
    ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const res = await query(`
    SELECT 
      m.id,
      m.type,
      m.product_id,
      p.sku AS product_sku,
      p.name AS product_name,
      p.unit AS product_unit,
      m.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      m.quantity_change,
      m.balance_after,
      m.unit_cost,
      m.transfer_id,
      m.reversal_of,
      m.reference_no,
      m.reason,
      m.notes,
      m.user_id,
      u.full_name AS user_name,
      m.created_at
    FROM inventory_movements m
    JOIN products p ON m.product_id = p.id
    JOIN warehouses w ON m.warehouse_id = w.id
    LEFT JOIN users u ON m.user_id = u.id
    ${whereClause}
    ORDER BY m.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `, params);

  return {
    data: res.rows,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  };
}
