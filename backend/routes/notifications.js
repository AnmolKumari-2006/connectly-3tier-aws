import { Router } from "express";
import { one, many } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { serializeNotification } from "../utils/social.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const rows = await many(
    "SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50",
    [req.user.id]
  );
  res.json({ notifications: await Promise.all(rows.map(serializeNotification)) });
});

router.post("/read-all", requireAuth, async (req, res) => {
  await one("UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND is_read = FALSE", [req.user.id]);
  res.json({ success: true });
});

router.post("/:id/read", requireAuth, async (req, res) => {
  const updated = await one(
    "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_id = $2 RETURNING id",
    [req.params.id, req.user.id]
  );
  if (!updated) return res.status(404).json({ error: "Notification not found." });
  res.json({ success: true });
});

export default router;
