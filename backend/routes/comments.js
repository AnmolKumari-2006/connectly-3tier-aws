import { Router } from "express";
import { one, transaction } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { postVisibleTo, createNotification } from "../utils/social.js";

const router = Router();

router.delete("/:commentId", requireAuth, async (req, res) => {
  const comment = await one("SELECT * FROM comments WHERE id = $1", [req.params.commentId]);
  if (!comment) return res.status(404).json({ error: "Comment not found." });

  const post = await one("SELECT * FROM posts WHERE id = $1", [comment.post_id]);
  if (comment.user_id !== req.user.id && post.user_id !== req.user.id) {
    return res.status(403).json({ error: "You can't delete this comment." });
  }

  await one("DELETE FROM comments WHERE id = $1", [comment.id]);
  const { c: commentCount } = await one("SELECT COUNT(*) AS c FROM comments WHERE post_id = $1", [post.id]);
  res.json({ success: true, commentCount });
});

// Like / unlike a comment (one like per user, toggles).
router.post("/:commentId/like", requireAuth, async (req, res) => {
  const comment = await one("SELECT * FROM comments WHERE id = $1", [req.params.commentId]);
  if (!comment) return res.status(404).json({ error: "Comment not found." });

  const post = await one("SELECT * FROM posts WHERE id = $1", [comment.post_id]);
  if (!post || !(await postVisibleTo(post, req.user.id))) {
    return res.status(403).json({ error: "Not allowed." });
  }

  const liked = await transaction(async (client) => {
    const removed = await one(
      "DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2 RETURNING id",
      [comment.id, req.user.id],
      client
    );
    if (removed) return false;

    await one(
      `INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)
       ON CONFLICT (comment_id, user_id) DO NOTHING`,
      [comment.id, req.user.id],
      client
    );
    await createNotification(
      { recipientId: comment.user_id, actorId: req.user.id, type: "comment_like", postId: comment.post_id },
      client
    );
    return true;
  });

  const { n: likeCount } = await one("SELECT COUNT(*) AS n FROM comment_likes WHERE comment_id = $1", [comment.id]);
  res.json({ liked, likeCount });
});

export default router;
