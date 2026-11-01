import { Router } from "express";
import { one, many, transaction } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { uploadPostMedia, mediaType } from "../utils/upload.js";
import {
  serializePost,
  serializeComment,
  postVisibleTo,
  visiblePosts,
  getFriendIds,
  createNotification,
} from "../utils/social.js";

const router = Router();

// ---- Feed: mine + friends' posts, newest first --------------------------------
router.get("/feed", requireAuth, async (req, res) => {
  const friendIds = await getFriendIds(req.user.id);
  const authorIds = [req.user.id, ...friendIds];

  // ANY($1) takes the whole id list as one array parameter.
  const rows = await many(
    "SELECT * FROM posts WHERE user_id = ANY($1::int[]) ORDER BY created_at DESC, id DESC",
    [authorIds]
  );

  res.json({ posts: await visiblePosts(rows, req.user.id) });
});

// ---- Explore: public posts across the whole platform --------------------------
router.get("/explore", requireAuth, async (req, res) => {
  const rows = await many("SELECT * FROM posts WHERE privacy = 'public' ORDER BY created_at DESC, id DESC");
  res.json({ posts: await visiblePosts(rows, req.user.id) });
});

// ---- Trending hashtags: most used #tags in public posts (last 30 days) ----------
router.get("/trending", requireAuth, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);

  // regexp_matches pulls every #tag out of the text. Only public posts from
  // public accounts are counted, so private content never leaks into trends.
  const rows = await many(
    `SELECT LOWER(m[1])                           AS key,
            MODE() WITHIN GROUP (ORDER BY m[1])   AS tag,
            COUNT(DISTINCT p.id)                  AS posts
     FROM posts p
     JOIN users u ON u.id = p.user_id
     CROSS JOIN LATERAL regexp_matches(p.text, '#([A-Za-z0-9_]{1,50})', 'g') AS m
     WHERE p.privacy = 'public'
       AND u.account_visibility = 'public'
       AND p.created_at > NOW() - make_interval(days => $1)
     GROUP BY LOWER(m[1])
     ORDER BY posts DESC, key ASC
     LIMIT $2`,
    [days, limit]
  );
  res.json({ days, hashtags: rows.map((r) => ({ tag: r.tag, posts: r.posts })) });
});

// ---- Posts containing a hashtag (privacy filtered) ---------------------------------
router.get("/hashtag/:tag", requireAuth, async (req, res) => {
  const tag = String(req.params.tag || "").replace(/^#/, "");
  if (!/^[A-Za-z0-9_]{1,50}$/.test(tag)) return res.status(400).json({ error: "Invalid hashtag." });

  // ~* is a case insensitive regex match; the tag must end at a non word character.
  const rows = await many(
    "SELECT * FROM posts WHERE text ~* $1 ORDER BY created_at DESC, id DESC LIMIT 100",
    [`#${tag}([^A-Za-z0-9_]|$)`]
  );
  res.json({ tag, posts: await visiblePosts(rows, req.user.id) });
});

// ---- Posts by a specific user (respecting privacy) -----------------------------
router.get("/user/:userId", requireAuth, async (req, res) => {
  const rows = await many(
    "SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC, id DESC",
    [req.params.userId]
  );
  res.json({ posts: await visiblePosts(rows, req.user.id) });
});

// ---- Create a post, with up to 4 images or 1 video -----------------------------
router.post("/", requireAuth, uploadPostMedia.array("media", 4), async (req, res) => {
  const { text = "", privacy = "public" } = req.body || {};
  const feeling = String(req.body?.feeling || "").trim();
  const location = String(req.body?.location || "").trim();
  const files = req.files || [];

  if (feeling.length > 40) return res.status(400).json({ error: "Feeling is too long." });
  if (location.length > 100) return res.status(400).json({ error: "Location is too long (max 100 characters)." });

  if (!text.trim() && files.length === 0) {
    return res.status(400).json({ error: "A post needs some text or a photo/video." });
  }
  if (!["public", "friends", "only_me"].includes(privacy)) {
    return res.status(400).json({ error: "Invalid privacy value." });
  }

  // The post and its media rows are saved together, or not at all.
  const post = await transaction(async (client) => {
    const created = await one(
      "INSERT INTO posts (user_id, text, privacy, feeling, location) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.user.id, text.trim(), privacy, feeling, location],
      client
    );
    for (const [i, file] of files.entries()) {
      await one(
        "INSERT INTO post_media (post_id, url, type, position) VALUES ($1, $2, $3, $4)",
        [created.id, `/uploads/posts/${file.filename}`, mediaType(file.filename), i],
        client
      );
    }
    return created;
  });

  res.status(201).json({ post: await serializePost(post, req.user.id) });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const post = await one("SELECT * FROM posts WHERE id = $1", [req.params.id]);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: "You can't delete this post." });

  await one("DELETE FROM posts WHERE id = $1", [post.id]);
  res.json({ success: true });
});

// ---- Bookmarks ------------------------------------------------------------------------
router.get("/bookmarks", requireAuth, async (req, res) => {
  const rows = await many(
    `SELECT p.* FROM bookmarks b JOIN posts p ON p.id = b.post_id
     WHERE b.user_id = $1 ORDER BY b.created_at DESC`,
    [req.user.id]
  );
  res.json({ posts: await visiblePosts(rows, req.user.id) });
});

router.post("/:id/bookmark", requireAuth, async (req, res) => {
  const post = await one("SELECT * FROM posts WHERE id = $1", [req.params.id]);
  if (!post) return res.status(404).json({ error: "Post not found." });

  const removed = await one(
    "DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2 RETURNING id",
    [post.id, req.user.id]
  );
  if (!removed) {
    await one(
      `INSERT INTO bookmarks (post_id, user_id) VALUES ($1, $2)
       ON CONFLICT (post_id, user_id) DO NOTHING`,
      [post.id, req.user.id]
    );
  }
  res.json({ bookmarked: !removed });
});

// ---- Likes ------------------------------------------------------------------------
router.post("/:id/like", requireAuth, async (req, res) => {
  const post = await one("SELECT * FROM posts WHERE id = $1", [req.params.id]);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (!(await postVisibleTo(post, req.user.id))) return res.status(403).json({ error: "Not allowed." });

  const liked = await transaction(async (client) => {
    const removed = await one(
      "DELETE FROM likes WHERE post_id = $1 AND user_id = $2 RETURNING id",
      [post.id, req.user.id],
      client
    );
    if (removed) return false;

    await one(
      "INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING",
      [post.id, req.user.id],
      client
    );
    await createNotification({ recipientId: post.user_id, actorId: req.user.id, type: "like", postId: post.id }, client);
    return true;
  });

  const { c: likeCount } = await one("SELECT COUNT(*) AS c FROM likes WHERE post_id = $1", [post.id]);
  res.json({ liked, likeCount });
});

// ---- Comments ------------------------------------------------------------------------
router.get("/:id/comments", requireAuth, async (req, res) => {
  const post = await one("SELECT * FROM posts WHERE id = $1", [req.params.id]);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (!(await postVisibleTo(post, req.user.id))) return res.status(403).json({ error: "Not allowed." });

  const rows = await many(
    "SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC, id ASC",
    [post.id]
  );
  res.json({ comments: await Promise.all(rows.map((c) => serializeComment(c, req.user.id))) });
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const post = await one("SELECT * FROM posts WHERE id = $1", [req.params.id]);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (!(await postVisibleTo(post, req.user.id))) return res.status(403).json({ error: "Not allowed." });

  const { text, parentId } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "Comment cannot be empty." });
  if (text.length > 500) return res.status(400).json({ error: "Comment is too long (max 500 characters)." });

  // A reply must point at a comment on the same post.
  let parent = null;
  if (parentId) {
    parent = await one("SELECT id FROM comments WHERE id = $1 AND post_id = $2", [parentId, post.id]);
    if (!parent) return res.status(400).json({ error: "The comment you replied to no longer exists." });
  }

  const comment = await transaction(async (client) => {
    const created = await one(
      "INSERT INTO comments (post_id, user_id, parent_id, text) VALUES ($1, $2, $3, $4) RETURNING *",
      [post.id, req.user.id, parent?.id ?? null, text.trim()],
      client
    );
    await createNotification({ recipientId: post.user_id, actorId: req.user.id, type: "comment", postId: post.id }, client);
    return created;
  });

  const { c: commentCount } = await one("SELECT COUNT(*) AS c FROM comments WHERE post_id = $1", [post.id]);
  res.status(201).json({ comment: await serializeComment(comment, req.user.id), commentCount });
});

// ---- A single post (for shared links: /post/:id) ----------------------------------
router.get("/:id", requireAuth, async (req, res) => {
  const post = await one("SELECT * FROM posts WHERE id = $1", [req.params.id]);
  if (!post || !(await postVisibleTo(post, req.user.id))) {
    return res.status(404).json({ error: "This post isn't available. It may have been deleted, or you don't have permission to see it." });
  }
  res.json({ post: await serializePost(post, req.user.id) });
});

export default router;
