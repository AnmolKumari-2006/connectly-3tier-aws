/**
 * Creates every table and index in the configured PostgreSQL database
 * without touching existing data. Handy for preparing Amazon RDS before the
 * first deploy:   npm run db:init
 */
import { pool, waitForDatabase, initSchema } from "../db.js";

try {
  await waitForDatabase();
  await initSchema();
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log(`Schema applied. ${rows.length} tables: ${rows.map((r) => r.table_name).join(", ")}`);
} catch (err) {
  console.error("Could not apply the schema:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
