import { query } from '../config/db.js';

export async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  try {
    const existing = await query(`
      SELECT response_code, response_body, expires_at
      FROM idempotency_keys
      WHERE key = $1
    `, [key]);

    if (existing.rows.length > 0) {
      const record = existing.rows[0];
      if (new Date(record.expires_at) > new Date()) {
        res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
        return res.status(record.response_code).json(record.response_body);
      }
    }

    // Intercept json response to cache
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const statusCode = res.statusCode || 200;
      // Only cache completed requests (status < 500)
      if (statusCode < 500) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        query(`
          INSERT INTO idempotency_keys (key, user_id, request_path, request_params, response_code, response_body, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (key) DO UPDATE
          SET response_code = EXCLUDED.response_code,
              response_body = EXCLUDED.response_body,
              expires_at = EXCLUDED.expires_at
        `, [
          key,
          req.user ? req.user.id : null,
          req.originalUrl || req.url,
          JSON.stringify({ body: req.body, query: req.query }),
          statusCode,
          JSON.stringify(body),
          expiresAt
        ]).catch(err => {
          console.error('[IDEMPOTENCY ERROR]', err.message);
        });
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    console.error('[IDEMPOTENCY MIDDLEWARE ERROR]', err);
    next();
  }
}
