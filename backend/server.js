import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { PORT, CLIENT_ORIGIN, UPLOADS_DIR, TRUST_PROXY, NODE_ENV } from "./config.js";
import { pool, waitForDatabase, initSchema } from "./db.js";
import { attachUser } from "./middleware/requireAuth.js";
import { seedDatabase } from "./seedData.js";
import { serveUploads, syncSeedFiles, checkStorage, usingS3 } from "./utils/storage.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import commentRoutes from "./routes/comments.js";
import friendRoutes from "./routes/friends.js";
import notificationRoutes from "./routes/notifications.js";
import messageRoutes from "./routes/messages.js";
import storyRoutes from "./routes/stories.js";

// ============================================================================
//  Connectly API — the APPLICATION TIER of the 3 tier architecture.
//
//    Tier 1 (web)   Nginx serves the React build and forwards /api + /uploads
//    Tier 2 (app)   this Express server
//    Tier 3 (data)  PostgreSQL (Amazon RDS in production)
// ============================================================================

const app = express();

// Behind Nginx: trust X-Forwarded-For / X-Forwarded-Proto from the web tier.
if (TRUST_PROXY) app.set("trust proxy", 1);

app.use(cors({ origin: CLIENT_ORIGIN.split(",").map((o) => o.trim()), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
// Uploaded photos/videos: from local disk, or streamed from the private S3 bucket.
app.use("/uploads", serveUploads(express.static(UPLOADS_DIR, { maxAge: "7d" })));
app.use(attachUser);

// Health check used by Nginx / load balancers / you, to confirm that the
// app tier is up AND can reach the data tier.
app.get("/api/health", async (req, res) => {
  const storage = await checkStorage();
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected", storage });
  } catch (err) {
    res.status(503).json({ status: "error", database: "unreachable", storage, error: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/stories", storyRoutes);

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// Every thrown or rejected error lands here (Express 5 forwards async errors
// automatically) and becomes a clean JSON response.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // PostgreSQL: invalid input such as /api/posts/abc for an integer id.
  if (err.code === "22P02") return res.status(400).json({ error: "Invalid request parameter." });
  // PostgreSQL: unique / foreign key / check constraint violations.
  if (err.code === "23505") return res.status(409).json({ error: "That already exists." });
  if (err.code === "23503") return res.status(400).json({ error: "Related record not found." });
  if (err.code === "23514") return res.status(400).json({ error: "Invalid value." });
  // Multer (uploads) and our own validation errors.
  if (err.name === "MulterError" || err.message?.startsWith("Unsupported file type")) {
    return res.status(400).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

async function start() {
  console.log(`Starting Connectly API (${NODE_ENV})…`);
  await waitForDatabase();
  await initSchema();

  // First run only: an empty database gets the demo accounts. After that the
  // data persists across restarts — nothing is re-seeded or wiped unless you
  // explicitly run `npm run seed`.
  const { rows } = await pool.query("SELECT COUNT(*) AS c FROM users");
  if (rows[0].c === 0) {
    console.log("Empty database — loading demo data (one-time)…");
    await seedDatabase();
  }

  if (usingS3) {
    const copied = await syncSeedFiles();
    console.log(`File storage: Amazon S3 (${copied} demo image(s) copied to the bucket).`);
  } else {
    console.log("File storage: local disk.");
  }

  const server = app.listen(PORT, () => {
    console.log(`Connectly API running on port ${PORT}`);
  });

  // Clean shutdown (systemd stop / Ctrl+C): stop accepting requests, then
  // close the database pool.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down…`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  console.error("Failed to start the API:", err.message);
  process.exit(1);
});
