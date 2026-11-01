import { Router } from "express";
import { one, many } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { uploadAvatar, uploadCover } from "../utils/upload.js";
import { publicUser, selfUser, friendshipStatus, mutualFriendsCount, getFriendIds } from "../utils/social.js";

const router = Router();

// ---- Search -----------------------------------------------------------------
router.get("/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results: [] });

  // ILIKE = case-insensitive match in PostgreSQL. Escape % and _ so they are
  // treated as normal characters, not wildcards.
  const like = `%${q.replace(/[\\%_]/g, (ch) => "\\" + ch)}%`;
  const rows = await many(
    `SELECT * FROM users
     WHERE id <> $1 AND (full_name ILIKE $2 OR username ILIKE $2)
     ORDER BY full_name ASC
     LIMIT 15`,
    [req.user.id, like]
  );

  const results = await Promise.all(
    rows.map(async (r) => ({
      ...(await publicUser(r)),
      status: await friendshipStatus(req.user.id, r.id),
    }))
  );
  res.json({ results });
});

// ---- People You May Know ------------------------------------------------------
router.get("/suggestions", requireAuth, async (req, res) => {
  const rows = await many("SELECT * FROM users WHERE id <> $1 ORDER BY id ASC", [req.user.id]);
  const withStatus = await Promise.all(
    rows.map(async (r) => ({ user: r, status: await friendshipStatus(req.user.id, r.id) }))
  );
  const suggestions = await Promise.all(
    withStatus
      .filter((s) => s.status === "none")
      .map(async (s) => ({
        ...(await publicUser(s.user)),
        status: s.status,
        mutual: await mutualFriendsCount(req.user.id, s.user.id),
      }))
  );
  suggestions.sort((a, b) => b.mutual - a.mutual);

  res.json({ suggestions });
});

// ---- Upcoming birthdays of my friends (next 30 days) ----------------------------
router.get("/birthdays", requireAuth, async (req, res) => {
  const friendIds = await getFriendIds(req.user.id);
  if (friendIds.length === 0) return res.json({ birthdays: [] });

  const rows = await many(
    "SELECT id, full_name, username, avatar, birthday FROM users WHERE id = ANY($1::int[]) AND birthday IS NOT NULL",
    [friendIds]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DAY = 86_400_000;

  const birthdays = rows
    .map((r) => {
      const [year, month, day] = r.birthday.split("-").map(Number);
      let next = new Date(today.getFullYear(), month - 1, day);
      if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
      const daysAway = Math.round((next - today) / DAY);
      return {
        user: { id: r.id, fullName: r.full_name, username: r.username, avatar: r.avatar },
        date: `${next.getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        daysAway,
        turningAge: next.getFullYear() - year,
      };
    })
    .filter((b) => b.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway);

  res.json({ birthdays });
});

// ---- Profile by username -------------------------------------------------------
router.get("/:username", requireAuth, async (req, res) => {
  const row = await one("SELECT * FROM users WHERE username = $1", [req.params.username]);
  if (!row) return res.status(404).json({ error: "User not found." });

  const status = await friendshipStatus(req.user.id, row.id);
  const isPrivateStranger =
    row.account_visibility === "private" && status !== "self" && status !== "friends";

  // Email is shown to yourself, and to friends only if "Show email on profile" is on.
  const canSeeEmail = status === "self" || (status === "friends" && row.show_email);

  res.json({
    user: { ...(await publicUser(row)), ...(canSeeEmail ? { email: row.email } : {}) },
    status,
    mutual:
      status === "none" || status === "request_sent" || status === "request_received"
        ? await mutualFriendsCount(req.user.id, row.id)
        : undefined,
    isPrivateStranger,
  });
});

// ---- Update my profile ----------------------------------------------------------
router.put("/me", requireAuth, async (req, res) => {
  const { fullName, bio, location } = req.body || {};
  if (fullName !== undefined && fullName !== null && String(fullName).trim().length > 100) {
    return res.status(400).json({ error: "Full name is too long (max 100 characters)." });
  }
  if (location && String(location).length > 100) {
    return res.status(400).json({ error: "Location is too long (max 100 characters)." });
  }
  if (bio && String(bio).length > 500) {
    return res.status(400).json({ error: "Bio is too long (max 500 characters)." });
  }

  // Birthday: "YYYY-MM-DD", or "" / null to remove it. Undefined leaves it unchanged.
  const { birthday } = req.body || {};
  let birthdayValue = req.user.birthday;
  if (birthday !== undefined) {
    if (birthday === null || birthday === "") {
      birthdayValue = null;
    } else {
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(birthday) && !Number.isNaN(Date.parse(birthday));
      const year = Number(String(birthday).slice(0, 4));
      if (!valid || year < 1900 || new Date(birthday) > new Date()) {
        return res.status(400).json({ error: "Please enter a valid birthday." });
      }
      birthdayValue = birthday;
    }
  }

  const updated = await one(
    `UPDATE users SET
       full_name = COALESCE($1, full_name),
       bio       = COALESCE($2, bio),
       location  = COALESCE($3, location),
       birthday  = $4
     WHERE id = $5
     RETURNING *`,
    [fullName?.trim() || null, bio ?? null, location ?? null, birthdayValue, req.user.id]
  );
  res.json({ user: await selfUser(updated) });
});

// Privacy settings: account visibility, default post privacy, activity status, email.
router.put("/me/privacy", requireAuth, async (req, res) => {
  const { accountVisibility, defaultPostPrivacy, showActivity, showEmail } = req.body || {};

  if (accountVisibility !== undefined && !["public", "private"].includes(accountVisibility)) {
    return res.status(400).json({ error: "accountVisibility must be 'public' or 'private'." });
  }
  if (defaultPostPrivacy !== undefined && !["public", "friends", "only_me"].includes(defaultPostPrivacy)) {
    return res.status(400).json({ error: "Invalid default post privacy." });
  }
  for (const [name, value] of Object.entries({ showActivity, showEmail })) {
    if (value !== undefined && typeof value !== "boolean") {
      return res.status(400).json({ error: `${name} must be true or false.` });
    }
  }

  const updated = await one(
    `UPDATE users SET
       account_visibility   = COALESCE($1, account_visibility),
       default_post_privacy = COALESCE($2, default_post_privacy),
       show_activity        = COALESCE($3, show_activity),
       show_email           = COALESCE($4, show_email)
     WHERE id = $5
     RETURNING *`,
    [accountVisibility ?? null, defaultPostPrivacy ?? null, showActivity ?? null, showEmail ?? null, req.user.id]
  );
  res.json({ user: await selfUser(updated) });
});

// Notification settings: which events create a notification for me.
router.put("/me/notifications", requireAuth, async (req, res) => {
  const { likes, comments, friendRequests, messages } = req.body || {};
  for (const [name, value] of Object.entries({ likes, comments, friendRequests, messages })) {
    if (value !== undefined && typeof value !== "boolean") {
      return res.status(400).json({ error: `${name} must be true or false.` });
    }
  }
  const updated = await one(
    `UPDATE users SET
       notify_likes           = COALESCE($1, notify_likes),
       notify_comments        = COALESCE($2, notify_comments),
       notify_friend_requests = COALESCE($3, notify_friend_requests),
       notify_messages        = COALESCE($4, notify_messages)
     WHERE id = $5
     RETURNING *`,
    [likes ?? null, comments ?? null, friendRequests ?? null, messages ?? null, req.user.id]
  );
  res.json({ user: await selfUser(updated) });
});

router.post("/me/avatar", requireAuth, uploadAvatar.single("avatar"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const url = `/uploads/avatars/${req.file.filename}`;
  const updated = await one("UPDATE users SET avatar = $1 WHERE id = $2 RETURNING *", [url, req.user.id]);
  res.json({ user: await selfUser(updated) });
});

router.post("/me/cover", requireAuth, uploadCover.single("cover"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const url = `/uploads/covers/${req.file.filename}`;
  const updated = await one("UPDATE users SET cover = $1 WHERE id = $2 RETURNING *", [url, req.user.id]);
  res.json({ user: await selfUser(updated) });
});

export default router;
