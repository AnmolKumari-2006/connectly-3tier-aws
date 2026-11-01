import { Router } from "express";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { one, many, query } from "../db.js";
import { hashPassword, checkPassword } from "../utils/auth.js";
import { selfUser } from "../utils/social.js";
import { JWT_SECRET, DEMO_MODE } from "../config.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  startSession,
  endSession,
  endOtherSessions,
  listSessions,
  clearAuthCookie,
} from "../utils/sessions.js";
import { generateSecret, verifyCode, otpauthUrl } from "../utils/totp.js";
import { DEMO_PASSWORD } from "../seedData.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const MIN_PASSWORD = 8;

// ---- Register --------------------------------------------------------------------
router.post("/register", async (req, res) => {
  const { fullName, username, email, password, confirmPassword } = req.body || {};
  const errors = [];

  if (!fullName || !fullName.trim()) errors.push("Full name is required.");
  else if (fullName.trim().length > 100) errors.push("Full name is too long (max 100 characters).");
  if (!username || !USERNAME_RE.test(username)) {
    errors.push("Username must be 3-30 characters (letters, numbers, underscores, dots).");
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 255) errors.push("Please enter a valid email address.");
  if (!password || password.length < MIN_PASSWORD) errors.push(`Password must be at least ${MIN_PASSWORD} characters.`);
  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.push("Passwords do not match.");
  }

  if (errors.length === 0) {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    if (await one("SELECT id FROM users WHERE username = $1", [normalizedUsername])) {
      errors.push("That username is already taken.");
    }
    if (await one("SELECT id FROM users WHERE email = $1", [normalizedEmail])) {
      errors.push("An account with that email already exists.");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const user = await one(
    `INSERT INTO users (full_name, username, email, password_hash, last_seen_at)
     VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    [fullName.trim(), username.trim().toLowerCase(), email.trim().toLowerCase(), await hashPassword(password)]
  );

  await startSession(req, res, user.id);
  res.status(201).json({ user: await selfUser(user) });
});

// ---- Login (step 1: password) -------------------------------------------------------
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: "Email/username and password are required." });
  }

  // People often type a username the way it's shown in the app ("@neha.joshi"),
  // so drop a leading "@" before looking the account up.
  const normalized = String(identifier).trim().toLowerCase().replace(/^@+/, "");
  const user = await one("SELECT * FROM users WHERE username = $1 OR email = $1", [normalized]);

  // Accidental spaces around a pasted password shouldn't lock anyone out.
  const passwordOk =
    !!user &&
    ((await checkPassword(String(password), user.password_hash)) ||
      (await checkPassword(String(password).trim(), user.password_hash)));

  if (!passwordOk) {
    return res.status(401).json({ error: "Invalid email/username or password." });
  }

  // Two factor accounts get a short lived challenge instead of a session.
  if (user.two_factor_enabled) {
    const challenge = jwt.sign({ sub: user.id, purpose: "2fa" }, JWT_SECRET, { expiresIn: "5m" });
    return res.json({ twoFactorRequired: true, challenge });
  }

  await startSession(req, res, user.id);
  res.json({ user: await selfUser(user) });
});

// ---- Login (step 2: 6 digit code from the authenticator app) ---------------------
router.post("/login/2fa", async (req, res) => {
  const { challenge, code } = req.body || {};
  let payload;
  try {
    payload = jwt.verify(String(challenge || ""), JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Your login attempt expired. Please enter your password again." });
  }
  if (payload.purpose !== "2fa") return res.status(401).json({ error: "Invalid login attempt." });

  const user = await one("SELECT * FROM users WHERE id = $1", [payload.sub]);
  if (!user || !user.two_factor_enabled || !verifyCode(user.two_factor_secret, code)) {
    return res.status(401).json({ error: "That code is not correct. Check your authenticator app and try again." });
  }

  await startSession(req, res, user.id);
  res.json({ user: await selfUser(user) });
});

// ---- Logout / current user ------------------------------------------------------------
router.post("/logout", async (req, res) => {
  await endSession(req.sessionId);
  clearAuthCookie(res);
  res.json({ success: true });
});

router.get("/me", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  res.json({ user: await selfUser(req.user) });
});

// ---- Demo accounts for the login page (only when DEMO_MODE is on) -------------------
router.get("/demo-accounts", async (req, res) => {
  if (!DEMO_MODE) return res.json({ enabled: false, accounts: [] });
  const accounts = await many(
    "SELECT username, full_name, avatar FROM users WHERE is_demo = TRUE ORDER BY id ASC"
  );
  res.json({
    enabled: accounts.length > 0,
    password: accounts.length > 0 ? DEMO_PASSWORD : null,
    accounts: accounts.map((a) => ({ username: a.username, fullName: a.full_name, avatar: a.avatar })),
  });
});

// ---- Change password ----------------------------------------------------------------
router.put("/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Enter your current password and a new password." });
  }
  if (!(await checkPassword(String(currentPassword), req.user.password_hash))) {
    return res.status(400).json({ error: "Your current password is incorrect." });
  }
  if (String(newPassword).length < MIN_PASSWORD) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD} characters.` });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "New password must be different from the current one." });
  }

  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(String(newPassword)), req.user.id]);
  // For safety, every other device has to log in again with the new password.
  const signedOut = await endOtherSessions(req.user.id, req.sessionId);
  res.json({ success: true, signedOutSessions: signedOut });
});

// ---- Active sessions (devices) ---------------------------------------------------------
router.get("/sessions", requireAuth, async (req, res) => {
  res.json({ sessions: await listSessions(req.user.id, req.sessionId) });
});

router.delete("/sessions/:id", requireAuth, async (req, res) => {
  if (req.params.id === req.sessionId) {
    return res.status(400).json({ error: "Use Log out to end the session on this device." });
  }
  const removed = await one("DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id", [
    req.params.id,
    req.user.id,
  ]);
  if (!removed) return res.status(404).json({ error: "Session not found." });
  res.json({ success: true });
});

router.post("/sessions/logout-others", requireAuth, async (req, res) => {
  const signedOut = await endOtherSessions(req.user.id, req.sessionId);
  res.json({ success: true, signedOutSessions: signedOut });
});

// ---- Two factor authentication setup ------------------------------------------------
// 1) setup: create a secret and return a QR code; 2fa is NOT on yet.
router.post("/2fa/setup", requireAuth, async (req, res) => {
  if (req.user.two_factor_enabled) {
    return res.status(400).json({ error: "Two factor authentication is already on." });
  }
  const secret = generateSecret();
  await query("UPDATE users SET two_factor_secret = $1 WHERE id = $2", [secret, req.user.id]);
  const url = otpauthUrl(secret, req.user.username);
  res.json({ secret, otpauthUrl: url, qrCode: await QRCode.toDataURL(url, { margin: 1, width: 220 }) });
});

// 2) enable: the user proves their app works by entering a current code.
router.post("/2fa/enable", requireAuth, async (req, res) => {
  const user = await one("SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1", [req.user.id]);
  if (user.two_factor_enabled) return res.status(400).json({ error: "Two factor authentication is already on." });
  if (!user.two_factor_secret) return res.status(400).json({ error: "Start the setup first." });
  if (!verifyCode(user.two_factor_secret, req.body?.code)) {
    return res.status(400).json({ error: "That code is not correct. Make sure your phone's time is set automatically." });
  }
  await query("UPDATE users SET two_factor_enabled = TRUE WHERE id = $1", [req.user.id]);
  res.json({ success: true, twoFactorEnabled: true });
});

// 3) disable: requires the account password.
router.post("/2fa/disable", requireAuth, async (req, res) => {
  if (!(await checkPassword(String(req.body?.password || ""), req.user.password_hash))) {
    return res.status(400).json({ error: "Your password is incorrect." });
  }
  await query("UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1", [req.user.id]);
  res.json({ success: true, twoFactorEnabled: false });
});

export default router;
