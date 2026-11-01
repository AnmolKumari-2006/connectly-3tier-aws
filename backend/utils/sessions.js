import crypto from "crypto";
import jwt from "jsonwebtoken";
import { one, many, query } from "../db.js";
import { JWT_SECRET, COOKIE_NAME, COOKIE_SECURE } from "../config.js";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** Readable device name from a User-Agent header, e.g. "Chrome on Windows". */
export function describeDevice(userAgent = "") {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /node|curl|undici/i.test(ua)
              ? "API client"
              : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Create a session row and set the signed login cookie for it. */
export async function startSession(req, res, userId) {
  const id = crypto.randomBytes(24).toString("hex");
  await query("INSERT INTO sessions (id, user_id, user_agent, ip) VALUES ($1, $2, $3, $4)", [
    id,
    userId,
    String(req.get("user-agent") || "").slice(0, 500),
    String(req.ip || "").slice(0, 64),
  ]);
  const token = jwt.sign({ sub: userId, sid: id }, JWT_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, maxAge: THIRTY_DAYS });
  return id;
}

/** Look up the user + session for a cookie token, or null if invalid/revoked. */
export async function resolveSession(token) {
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (!Number.isInteger(payload?.sub) || typeof payload?.sid !== "string") return null;

  const row = await one(
    `SELECT s.id AS session_id, s.last_used_at AS session_last_used, u.*
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.user_id = $2 AND s.created_at > NOW() - INTERVAL '30 days'`,
    [payload.sid, payload.sub]
  );
  return row;
}

/** Record activity (throttled to once a minute so we don't write on every request). */
export async function touchSession(sessionId, userId, lastUsedAt) {
  if (lastUsedAt && Date.now() - new Date(lastUsedAt).getTime() < 60_000) return;
  await Promise.all([
    query("UPDATE sessions SET last_used_at = NOW() WHERE id = $1", [sessionId]),
    query("UPDATE users SET last_seen_at = NOW() WHERE id = $1", [userId]),
  ]);
}

export async function endSession(sessionId) {
  if (sessionId) await query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function endOtherSessions(userId, keepSessionId) {
  const { rowCount } = await query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [userId, keepSessionId]);
  return rowCount;
}

export async function listSessions(userId, currentSessionId) {
  const rows = await many(
    "SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_used_at DESC",
    [userId]
  );
  return rows.map((s) => ({
    id: s.id,
    device: describeDevice(s.user_agent),
    ip: s.ip,
    createdAt: s.created_at.toISOString(),
    lastUsedAt: s.last_used_at.toISOString(),
    current: s.id === currentSessionId,
  }));
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE });
}
