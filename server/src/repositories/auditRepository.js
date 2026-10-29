import { query } from '../config/db.js';

export async function logAction({
  userId = null,
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
}) {
  try {
    const res = await query(`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      userId,
      action,
      entityType,
      entityId ? String(entityId) : null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
    ]);
    return res.rows[0];
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err.message);
    return null;
  }
}

export async function listAuditLogs({ page = 1, limit = 20, entityType = null, action = null }) {
  const offset = (page - 1) * limit;
  const params = [];
  const where = [];

  if (entityType) {
    params.push(entityType);
    where.push(`a.entity_type = $${params.length}`);
  }
  if (action) {
    params.push(action);
    where.push(`a.action = $${params.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await query(`
    SELECT COUNT(*) FROM audit_log a ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const res = await query(`
    SELECT 
      a.*,
      u.full_name AS user_name,
      u.role AS user_role
    FROM audit_log a
    LEFT JOIN users u ON a.user_id = u.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `, params);

  return {
    data: res.rows,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  };
}
