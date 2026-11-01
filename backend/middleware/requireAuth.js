import { COOKIE_NAME } from "../config.js";
import { resolveSession, touchSession, clearAuthCookie } from "../utils/sessions.js";

// Attaches req.user (and req.sessionId) when the cookie belongs to a live
// session row. Signing out, changing the password or "sign out other
// devices" deletes session rows, which immediately logs those devices out.
export async function attachUser(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    const row = await resolveSession(token);
    if (row) {
      const { session_id: sessionId, session_last_used: lastUsed, ...user } = row;
      req.user = user;
      req.sessionId = sessionId;
      touchSession(sessionId, user.id, lastUsed).catch(() => {});
    } else {
      clearAuthCookie(res);
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  next();
}
