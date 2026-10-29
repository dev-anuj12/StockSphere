import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;
let pgliteInstance = null;
let isPGlite = false;

export async function getDb() {
  if (pool) return { type: 'pg', client: pool };
  if (pgliteInstance) return { type: 'pglite', client: pgliteInstance };

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && dbUrl.trim() !== '') {
    try {
      const pgPool = new pg.Pool({
        connectionString: dbUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await pgPool.connect();
      await client.query('SELECT 1');
      client.release();
      pool = pgPool;
      isPGlite = false;
      console.log('[DB] Connected to PostgreSQL via pg.Pool');
      await ensureSchema();
      return { type: 'pg', client: pool };
    } catch (err) {
      console.warn('[DB] PostgreSQL connection failed. Falling back to embedded PGlite engine:', err.message);
    }
  }

  // Fallback to embedded PGlite
  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = process.env.NODE_ENV === 'test' 
    ? undefined 
    : path.join(__dirname, '../../../.data/pglite');
    
  if (dataDir && !fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  pgliteInstance = new PGlite(dataDir);
  isPGlite = true;
  console.log(`[DB] Connected to embedded PGlite engine (${dataDir ? 'persisted at ' + dataDir : 'in-memory'})`);
  await ensureSchema();
  return { type: 'pglite', client: pgliteInstance };
}

export async function query(text, params = []) {
  const db = await getDb();
  if (db.type === 'pg') {
    return await pool.query(text, params);
  } else {
    const res = await pgliteInstance.query(text, params);
    return {
      rows: res.rows || [],
      rowCount: res.rows ? res.rows.length : (res.affectedRows || 0),
    };
  }
}

export async function exec(text) {
  const db = await getDb();
  if (db.type === 'pg') {
    return await pool.query(text);
  } else {
    return await pgliteInstance.exec(text);
  }
}

export async function getClient() {
  const db = await getDb();
  if (db.type === 'pg') {
    const client = await pool.connect();
    return {
      query: (sql, params) => client.query(sql, params),
      release: () => client.release(),
    };
  } else {
    // For PGlite, it's single-process wasm; we wrap query & transaction
    return {
      query: async (sql, params) => {
        const res = await pgliteInstance.query(sql, params);
        return {
          rows: res.rows || [],
          rowCount: res.rows ? res.rows.length : (res.affectedRows || 0),
        };
      },
      release: () => {},
    };
  }
}

export async function ensureSchema() {
  try {
    const migrationPath = path.join(__dirname, '../../../database/migrations/001_initial_schema.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      if (pool) {
        await pool.query(sql);
      } else if (pgliteInstance) {
        await pgliteInstance.exec(sql);
      }
      console.log('[DB] Database schema verified/initialized successfully');
    }
  } catch (err) {
    console.error('[DB] Schema initialization error:', err.message);
    throw err;
  }
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
}
