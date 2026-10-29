import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function errorHandler(err, req, res, next) {
  // Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.statusCode === 401 ? 'UNAUTHORIZED'
          : err.statusCode === 403 ? 'FORBIDDEN'
          : err.statusCode === 404 ? 'NOT_FOUND'
          : err.statusCode === 409 ? 'CONFLICT'
          : 'BAD_REQUEST',
      message: err.message,
      details: err.details || null,
    });
  }

  // PostgreSQL Unique Constraint Violation
  if (err.code === '23505') {
    return res.status(409).json({
      code: 'DUPLICATE_ENTRY',
      message: 'A record with this unique identifier already exists',
      details: err.detail || null,
    });
  }

  // PostgreSQL Foreign Key / Restrict Violation
  if (err.code === '23503') {
    return res.status(409).json({
      code: 'FOREIGN_KEY_VIOLATION',
      message: 'Operation cannot be completed because related records exist or reference is invalid',
      details: err.detail || null,
    });
  }

  // Append-only ledger mutation violation from trigger
  if (err.message && err.message.includes('Inventory movements are immutable append-only ledger entries')) {
    return res.status(403).json({
      code: 'LEDGER_IMMUTABLE',
      message: err.message,
      details: null,
    });
  }

  // Fallback 500
  console.error('[UNHANDLED ERROR]', err);
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal server error occurred',
    details: process.env.NODE_ENV === 'development' ? err.message : null,
  });
}
