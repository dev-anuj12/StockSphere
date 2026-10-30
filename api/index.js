// Vercel Serverless Function — StockSphere API
import { getDb } from '../server/src/config/db.js';
import app from '../server/src/app.js';

let dbInitPromise = null;

export default async function handler(req, res) {
  if (!dbInitPromise) {
    dbInitPromise = getDb().catch(err => {
      console.error('[DB INIT ERROR]', err);
      dbInitPromise = null;
      throw err;
    });
  }

  try {
    await dbInitPromise;
  } catch (err) {
    return res.status(500).json({
      code: 'DATABASE_ERROR',
      message: 'Failed to initialize database connection: ' + err.message,
    });
  }

  return new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', reject);
    app(req, res);
  });
}
