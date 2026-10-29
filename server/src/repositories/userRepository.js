import { query } from '../config/db.js';

export async function findByUsernameOrEmail(identifier) {
  const res = await query(`
    SELECT * FROM users
    WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
  `, [identifier.trim()]);
  return res.rows[0] || null;
}

export async function findById(id) {
  const res = await query(`
    SELECT id, username, email, full_name, role, status, failed_login_attempts, locked_until, created_at, updated_at
    FROM users WHERE id = $1
  `, [id]);
  return res.rows[0] || null;
}

export async function findStaffWarehouses(userId) {
  const res = await query(`
    SELECT w.id, w.name, w.code, w.location
    FROM user_warehouses uw
    JOIN warehouses w ON uw.warehouse_id = w.id
    WHERE uw.user_id = $1
  `, [userId]);
  return res.rows;
}

export async function recordFailedLogin(userId, maxAttempts = 5, lockoutMinutes = 15) {
  const user = await findById(userId);
  if (!user) return;

  const newAttempts = user.failed_login_attempts + 1;
  let lockedUntil = null;

  if (newAttempts >= maxAttempts) {
    lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
  }

  await query(`
    UPDATE users
    SET failed_login_attempts = $1,
        locked_until = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [newAttempts, lockedUntil, userId]);

  return { attempts: newAttempts, lockedUntil };
}

export async function resetFailedLogins(userId) {
  await query(`
    UPDATE users
    SET failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [userId]);
}

export async function countActiveAdmins() {
  const res = await query(`
    SELECT COUNT(*) AS count FROM users
    WHERE role = 'admin' AND status = 'active'
  `);
  return parseInt(res.rows[0].count, 10);
}

export async function listUsers({ page = 1, limit = 10, sort = 'created_at', order = 'DESC', search = '' }) {
  const offset = (page - 1) * limit;
  const validSorts = ['username', 'email', 'full_name', 'role', 'status', 'created_at'];
  const sortCol = validSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const params = [];
  let whereClause = 'WHERE 1=1';

  if (search && search.trim() !== '') {
    params.push(`%${search.trim().toLowerCase()}%`);
    whereClause += ` AND (LOWER(username) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(full_name) LIKE $${params.length})`;
  }

  const countRes = await query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const dataRes = await query(`
    SELECT id, username, email, full_name, role, status, locked_until, created_at, updated_at
    FROM users
    ${whereClause}
    ORDER BY ${sortCol} ${sortOrder}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `, params);

  return { data: dataRes.rows, total, page, limit };
}

export async function createUser({ username, email, password_hash, full_name, role, status = 'active' }) {
  const res = await query(`
    INSERT INTO users (username, email, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, username, email, full_name, role, status, created_at
  `, [username, email, password_hash, full_name, role, status]);
  return res.rows[0];
}

export async function updateUser(id, { full_name, role, email, password_hash }) {
  const fields = [];
  const values = [];

  if (full_name !== undefined) {
    values.push(full_name);
    fields.push(`full_name = $${values.length}`);
  }
  if (role !== undefined) {
    values.push(role);
    fields.push(`role = $${values.length}`);
  }
  if (email !== undefined) {
    values.push(email);
    fields.push(`email = $${values.length}`);
  }
  if (password_hash !== undefined) {
    values.push(password_hash);
    fields.push(`password_hash = $${values.length}`);
  }

  if (fields.length === 0) return await findById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const res = await query(`
    UPDATE users SET ${fields.join(', ')}
    WHERE id = $${values.length}
    RETURNING id, username, email, full_name, role, status, updated_at
  `, values);

  return res.rows[0];
}

export async function updateUserStatus(id, status) {
  const res = await query(`
    UPDATE users
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, username, email, full_name, role, status, updated_at
  `, [status, id]);
  return res.rows[0];
}

export async function assignUserWarehouses(userId, warehouseIds = []) {
  await query('DELETE FROM user_warehouses WHERE user_id = $1', [userId]);
  for (const whId of warehouseIds) {
    await query('INSERT INTO user_warehouses (user_id, warehouse_id) VALUES ($1, $2)', [userId, whId]);
  }
}

// Refresh Tokens
export async function storeRefreshToken(userId, tokenHash, expiresAt) {
  const res = await query(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [userId, tokenHash, expiresAt]);
  return res.rows[0];
}

export async function findRefreshToken(tokenHash) {
  const res = await query(`
    SELECT * FROM refresh_tokens
    WHERE token_hash = $1 AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP
  `, [tokenHash]);
  return res.rows[0] || null;
}

export async function revokeRefreshToken(tokenHash) {
  await query(`
    UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1
  `, [tokenHash]);
}

export async function revokeAllUserRefreshTokens(userId) {
  await query(`
    UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1
  `, [userId]);
}
