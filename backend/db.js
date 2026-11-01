import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { DB_CONFIG, DB_SSL, DB_POOL_MAX } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool, types } = pg;

// COUNT(*) and other BIGINT results arrive as strings by default (to avoid
// precision loss above 2^53). Our counts are tiny, so return real numbers.
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));
// DATE columns (birthdays) stay plain "YYYY-MM-DD" strings, no time zone shifts.
types.setTypeParser(types.builtins.DATE, (value) => value);

// One shared connection pool for the whole API. On AWS this connects from
// the application tier (EC2, private subnet) to Amazon RDS (data tier).
export const pool = new Pool({
  ...DB_CONFIG,
  max: DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // RDS uses certificates from Amazon's own CA; for a simple setup we accept
  // it without bundling the CA file. Traffic is still encrypted.
  ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  // An idle client lost its connection (e.g. RDS restarted). The pool will
  // open a fresh one on the next query, so just log it.
  console.error("PostgreSQL pool error:", err.message);
});

// ---- Query helpers ---------------------------------------------------------------
// Every helper takes an optional `client` so the same code works both with
// the shared pool and inside a transaction (see `transaction` below).

/** Run a statement and return the full pg result (rows, rowCount). */
export function query(text, params = [], client = pool) {
  return client.query(text, params);
}

/** First row or null. */
export async function one(text, params = [], client = pool) {
  const { rows } = await client.query(text, params);
  return rows[0] ?? null;
}

/** All rows (array, possibly empty). */
export async function many(text, params = [], client = pool) {
  const { rows } = await client.query(text, params);
  return rows;
}

/** Run `work(client)` inside BEGIN / COMMIT, rolling back on any error. */
export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---- Startup ---------------------------------------------------------------------

/** Wait until PostgreSQL accepts connections (RDS can take a moment). */
export async function waitForDatabase({ attempts = 10, delayMs = 3000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      console.warn(`Database not reachable yet (attempt ${i}/${attempts}): ${err.message}`);
      if (i === attempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Create all tables and indexes if they don't exist yet (idempotent). */
export async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, "database", "schema.sql"), "utf8");
  await pool.query(sql);
}

export default pool;
