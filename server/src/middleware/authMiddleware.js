import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';

export async function authenticate(req, res, next) {
  try {
    let token = null;

    // Check cookie first
    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Authentication required. No access token provided.', 401);
    }

    const secret = process.env.JWT_SECRET || 'stocksphere-jwt-access-secret-minimum-32-characters-key!';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      throw new AppError('Invalid or expired access token.', 401);
    }

    const userRes = await query(`
      SELECT id, username, email, full_name, role, status, locked_until
      FROM users WHERE id = $1
    `, [decoded.userId]);

    if (userRes.rows.length === 0) {
      throw new AppError('User account not found.', 401);
    }

    const user = userRes.rows[0];

    if (user.status !== 'active') {
      throw new AppError('Account is deactivated. Contact an administrator.', 403);
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError(`Account is temporarily locked until ${new Date(user.locked_until).toISOString()}`, 403);
    }

    // Load warehouse assignments for Staff
    if (user.role === 'staff') {
      const whRes = await query(`
        SELECT warehouse_id FROM user_warehouses WHERE user_id = $1
      `, [user.id]);
      user.warehouses = whRes.rows.map(r => r.warehouse_id);
    } else {
      user.warehouses = null; // null represents global access
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(`Access denied. Role '${req.user.role}' is not authorized for this action.`, 403));
    }

    next();
  };
}

export function checkWarehouseAccess(user, warehouseId) {
  if (user.role === 'admin' || user.role === 'manager') {
    return true;
  }
  if (user.role === 'staff') {
    return Array.isArray(user.warehouses) && user.warehouses.includes(warehouseId);
  }
  return false;
}
