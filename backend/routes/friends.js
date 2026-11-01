import { Router } from "express";
import { one, many, transaction } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  publicUser,
  friendshipStatus,
  mutualFriendsCount,
  createNotification,
  findUserById,
  toIso,
} from "../utils/social.js";

const router = Router();

/** Accepted friends of a user, as public profiles. */
async function friendsOf(userId) {
  const rows = await many(
    `SELECT u.* FROM friend_requests fr
     JOIN users u ON u.id = CASE WHEN fr.sender_id = $1 THEN fr.receiver_id ELSE fr.sender_id END
     WHERE fr.status = 'accepted' AND (fr.sender_id = $1 OR fr.receiver_id = $1)
     ORDER BY u.full_name ASC`,
    [userId]
  );
  return Promise.all(rows.map((u) => publicUser(u)));
}

router.get("/status/:userId", requireAuth, async (req, res) => {
  const otherId = Number(req.params.userId);
  res.json({ status: await friendshipStatus(req.user.id, otherId) });
});

// ---- Incoming: requests sent TO me, still pending -----------------------------
router.get("/incoming", requireAuth, async (req, res) => {
  const rows = await many(
    `SELECT * FROM friend_requests
     WHERE receiver_id = $1 AND status = 'pending'
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  const incoming = await Promise.all(
    rows.map(async (r) => ({
      requestId: r.id,
      sentAt: toIso(r.created_at),
      mutual: await mutualFriendsCount(req.user.id, r.sender_id),
      user: await publicUser(await findUserById(r.sender_id)),
    }))
  );
  res.json({ incoming });
});

// ---- Sent: requests I sent, still pending -------------------------------------
router.get("/sent", requireAuth, async (req, res) => {
  const rows = await many(
    `SELECT * FROM friend_requests
     WHERE sender_id = $1 AND status = 'pending'
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  const sent = await Promise.all(
    rows.map(async (r) => ({
      requestId: r.id,
      sentAt: toIso(r.created_at),
      user: await publicUser(await findUserById(r.receiver_id)),
    }))
  );
  res.json({ sent });
});

// ---- My accepted friends ----------------------------------------------------
router.get("/list", requireAuth, async (req, res) => {
  res.json({ friends: await friendsOf(req.user.id) });
});

// ---- Friends of any user (respecting private accounts) ------------------------
router.get("/of/:userId", requireAuth, async (req, res) => {
  const targetId = Number(req.params.userId);
  const target = await findUserById(targetId);
  if (!target) return res.status(404).json({ error: "User not found." });

  const status = await friendshipStatus(req.user.id, targetId);
  if (target.account_visibility === "private" && status !== "self" && status !== "friends") {
    return res.status(403).json({ error: "This account is private." });
  }

  res.json({ friends: await friendsOf(targetId) });
});

// ---- Send a request -----------------------------------------------------------
router.post("/request/:userId", requireAuth, async (req, res) => {
  const receiverId = Number(req.params.userId);
  if (receiverId === req.user.id) {
    return res.status(400).json({ error: "You cannot friend yourself." });
  }
  const receiver = await findUserById(receiverId);
  if (!receiver) return res.status(404).json({ error: "User not found." });

  const status = await friendshipStatus(req.user.id, receiverId);
  if (status !== "none") {
    return res.status(400).json({ error: "A request already exists or you are already friends." });
  }

  await transaction(async (client) => {
    // A request that was rejected earlier would block a new one because of
    // the UNIQUE(sender_id, receiver_id) rule, so clear old rejected rows.
    await one(
      `DELETE FROM friend_requests WHERE status = 'rejected'
       AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))`,
      [req.user.id, receiverId],
      client
    );
    const request = await one(
      "INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'pending') RETURNING id",
      [req.user.id, receiverId],
      client
    );
    await createNotification(
      { recipientId: receiverId, actorId: req.user.id, type: "friend_request", friendRequestId: request.id },
      client
    );
  });

  res.json({ status: "request_sent" });
});

// ---- Cancel a request I sent ----------------------------------------------------
router.post("/cancel/:userId", requireAuth, async (req, res) => {
  const receiverId = Number(req.params.userId);
  const removed = await one(
    "DELETE FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending' RETURNING id",
    [req.user.id, receiverId]
  );

  if (!removed) return res.status(404).json({ error: "No pending request found." });
  res.json({ status: "none" });
});

// ---- Accept a request sent TO me, by the sender's user id ----------------------
router.post("/accept/:userId", requireAuth, async (req, res) => {
  const senderId = Number(req.params.userId);

  const accepted = await transaction(async (client) => {
    const request = await one(
      `UPDATE friend_requests SET status = 'accepted', responded_at = NOW()
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING id`,
      [senderId, req.user.id],
      client
    );
    if (!request) return false;

    await createNotification(
      { recipientId: senderId, actorId: req.user.id, type: "friend_accept", friendRequestId: request.id },
      client
    );
    return true;
  });

  if (!accepted) return res.status(404).json({ error: "No pending request from this user." });
  res.json({ status: "friends" });
});

// ---- Reject a request sent TO me -------------------------------------------------
router.post("/reject/:userId", requireAuth, async (req, res) => {
  const senderId = Number(req.params.userId);
  const rejected = await one(
    `UPDATE friend_requests SET status = 'rejected', responded_at = NOW()
     WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
     RETURNING id`,
    [senderId, req.user.id]
  );

  if (!rejected) return res.status(404).json({ error: "No pending request from this user." });
  res.json({ status: "none" });
});

// ---- Remove an existing friendship -----------------------------------------------
router.post("/remove/:userId", requireAuth, async (req, res) => {
  const otherId = Number(req.params.userId);
  const removed = await one(
    `DELETE FROM friend_requests WHERE status = 'accepted'
     AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
     RETURNING id`,
    [req.user.id, otherId]
  );

  if (!removed) return res.status(404).json({ error: "You are not friends with this user." });
  res.json({ status: "none" });
});

export default router;
