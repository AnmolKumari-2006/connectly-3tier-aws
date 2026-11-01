/**
 * Manual reset: wipes EVERYTHING (accounts you registered, posts, messages,
 * friend requests…) and reloads the demo data.
 *
 * You do NOT need to run this to get started — the server creates the tables
 * and loads the demo data automatically the first time it starts with an
 * empty database. Only run `npm run seed` when you deliberately want to
 * throw away all data.
 */
import { pool, waitForDatabase, initSchema } from "./db.js";
import { seedDatabase } from "./seedData.js";

try {
  await waitForDatabase();
  await initSchema();
  console.log("⚠️  Resetting the database — all existing data will be deleted.\n");
  await seedDatabase();
} catch (err) {
  console.error("Seeding failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
