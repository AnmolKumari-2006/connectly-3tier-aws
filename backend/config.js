import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env if it exists (built into Node 21.7+, no dotenv needed).
// Real environment variables (e.g. set by systemd on EC2) always win.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  /* no .env file — fall back to real env vars / defaults */
}

const bool = (value, fallback = false) =>
  value === undefined || value === "" ? fallback : ["1", "true", "yes", "on"].includes(String(value).toLowerCase());

// ---- Application tier ---------------------------------------------------------
export const PORT = Number(process.env.PORT) || 4000;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PROD = NODE_ENV === "production";
export const JWT_SECRET = process.env.JWT_SECRET || "connectly-dev-secret-change-in-production";
// Never run a production server with the publicly known development secret:
// anyone could forge login cookies with it.
if (IS_PROD && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set when NODE_ENV=production.");
}
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:8080,http://localhost:5173";
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
export const COOKIE_NAME = "connectly_token";
// Only mark the cookie "secure" when the site is actually served over HTTPS,
// otherwise the browser silently drops it and nobody can log in.
export const COOKIE_SECURE = bool(process.env.COOKIE_SECURE, false);
// Demo mode lists the seeded demo accounts on the login page. Turn it off
// for a real deployment.
export const DEMO_MODE = bool(process.env.DEMO_MODE, !IS_PROD);
// Behind Nginx (the web tier) Express should trust the X-Forwarded-* headers.
export const TRUST_PROXY = bool(process.env.TRUST_PROXY, IS_PROD);

// ---- File storage (photos, videos, avatars, stories) ---------------------------
// "local": files are saved in UPLOADS_DIR on this server (local development).
// "s3":    files are saved in an Amazon S3 bucket, so the API server keeps no
//          state and can be replaced at any time (AWS deployment).
export const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || "local").toLowerCase();
export const S3_BUCKET = process.env.S3_BUCKET || "";
export const S3_PREFIX = process.env.S3_PREFIX ?? "uploads/";
export const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
// Only for testing against an S3 compatible server (e.g. a local emulator).
export const S3_ENDPOINT = process.env.S3_ENDPOINT || "";

// ---- Data tier (PostgreSQL / Amazon RDS) ------------------------------------
// Either a single DATABASE_URL, or the individual DB_* variables.
export const DB_CONFIG = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || "connectly",
      password: process.env.DB_PASSWORD || "connectly_pass",
      database: process.env.DB_NAME || "connectly",
    };
// Amazon RDS for PostgreSQL requires SSL by default (rds.force_ssl = 1).
export const DB_SSL = bool(process.env.DB_SSL, false);
export const DB_POOL_MAX = Number(process.env.DB_POOL_MAX) || 10;
