// Vercel Serverless Function — StockSphere API
// Exports the Express app so Vercel can handle requests without calling app.listen()
import { getDb } from '../server/src/config/db.js';
import app from '../server/src/app.js';

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await getDb();
    initialized = true;
  }
}

export default async function handler(req, res) {
  await ensureInit();
  return app(req, res);
}
