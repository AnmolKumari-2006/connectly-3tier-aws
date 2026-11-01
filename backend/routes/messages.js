import { Router } from "express";
import { one, many, transaction } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  publicUser,
  isFriendsWith,
  serializeMessage,
  createNotification,
  getFriendIds,
  findUserById,
  presenceOf,
} from "../utils/social.js";

const router = Router();

// ---- Conversation list: every friend, with their last message (if any) ------
router.get("/conversations", requireAuth, async (req, res) => {
  const friendIds = await getFriendIds(req.user.id);

  const conversations = await Promise.all(
    friendIds.map(async (friendId) => {
      const [friend, lastMessage, unread] = await Promise.all([
        findUserById(friendId),
        one(
          `SELECT * FROM messages
           WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
          [req.user.id, friendId]
        ),
        one(
          "SELECT COUNT(*) AS c FROM messages WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE",
          [friendId, req.user.id]
        ),
      ]);

      return {
        user: { ...(await publicUser(friend)), presence: presenceOf(friend) },
        lastMessage: lastMessage ? await serializeMessage(lastMessage, req.user.id) : null,
        unreadCount: unread.c,
      };
    })
  );

  // Conversations with messages float to the top, newest first; friends
  // you haven't messaged yet sort alphabetically below.
  conversations.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    }
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return a.user.fullName.localeCompare(b.user.fullName);
  });

  res.json({ conversations });
});

// ---- Like / unlike a single chat message (either participant can) ----------
router.post("/like/:messageId", requireAuth, async (req, res) => {
  const message = await one("SELECT * FROM messages WHERE id = $1", [req.params.messageId]);
  if (!message) return res.status(404).json({ error: "Message not found." });
  if (message.sender_id !== req.user.id && message.receiver_id !== req.user.id) {
    return res.status(403).json({ error: "Not allowed." });
  }

  const removed = await one(
    "DELETE FROM message_likes WHERE message_id = $1 AND user_id = $2 RETURNING id",
    [message.id, req.user.id]
  );
  if (!removed) {
    await one(
      `INSERT INTO message_likes (message_id, user_id) VALUES ($1, $2)
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [message.id, req.user.id]
    );
  }

  const { n: likeCount } = await one("SELECT COUNT(*) AS n FROM message_likes WHERE message_id = $1", [message.id]);
  res.json({ liked: !removed, likeCount });
});

// ---- One thread: the most recent 200 messages, oldest first ------------------
router.get("/:userId", requireAuth, async (req, res) => {
  const otherId = Number(req.params.userId);
  const other = await findUserById(otherId);
  if (!other) return res.status(404).json({ error: "User not found." });
  if (!(await isFriendsWith(req.user.id, otherId))) {
    return res.status(403).json({ error: "You can only message your friends." });
  }

  const rows = await many(
    `SELECT * FROM (
       SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at DESC, id DESC
       LIMIT 200
     ) AS recent
     ORDER BY created_at ASC, id ASC`,
    [req.user.id, otherId]
  );

  res.json({
    user: { ...(await publicUser(other)), presence: presenceOf(other) },
    messages: await Promise.all(rows.map((m) => serializeMessage(m, req.user.id))),
  });
});

// ---- Send a message --------------------------------------------------------------
router.post("/:userId", requireAuth, async (req, res) => {
  const otherId = Number(req.params.userId);
  const other = await findUserById(otherId);
  if (!other) return res.status(404).json({ error: "User not found." });
  if (!(await isFriendsWith(req.user.id, otherId))) {
    return res.status(403).json({ error: "You can only message your friends." });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "Message cannot be empty." });
  if (text.length > 2000) return res.status(400).json({ error: "Message is too long." });

  const message = await transaction(async (client) => {
    const created = await one(
      "INSERT INTO messages (sender_id, receiver_id, text) VALUES ($1, $2, $3) RETURNING *",
      [req.user.id, otherId, text.trim()],
      client
    );
    await createNotification({ recipientId: otherId, actorId: req.user.id, type: "message" }, client);
    return created;
  });

  res.status(201).json({ message: await serializeMessage(message, req.user.id) });
});

// ---- Mark a thread as read ---------------------------------------------------------
router.post("/:userId/read", requireAuth, async (req, res) => {
  const otherId = Number(req.params.userId);
  await one(
    "UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE",
    [otherId, req.user.id]
  );
  res.json({ success: true });
});

export default router;
