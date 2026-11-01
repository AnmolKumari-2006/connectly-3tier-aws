import { Router } from "express";
import { one, many } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { uploadStoryMedia, mediaType } from "../utils/upload.js";
import { getFriendIds, isFriendsWith, toIso } from "../utils/social.js";
import { removeUpload } from "../utils/storage.js";

const router = Router();

// Background keys for text-only stories. The frontend maps each key to a
// gradient (see frontend/src/utils/storyBackgrounds.js) — keep both in sync.
export const STORY_BACKGROUNDS = ["ocean", "sunset", "forest", "grape", "night", "rose"];
const MAX_TEXT = 300;

// Stories live for 24 hours. Expired rows (and their uploaded files) are
// cleaned up lazily whenever the stories API is used — no cron job needed.
async function purgeExpired() {
  const expired = await many("DELETE FROM stories WHERE expires_at <= NOW() RETURNING media_url");
  expired.forEach(removeMediaFile);
}

function removeMediaFile(story) {
  if (!story.media_url || !story.media_url.startsWith("/uploads/stories/")) return;
  removeUpload(story.media_url);
}

async function canSee(story, viewerId) {
  return story.user_id === viewerId || isFriendsWith(viewerId, story.user_id);
}

async function serializeStory(s, viewerId) {
  const isOwner = s.user_id === viewerId;
  const stats = await one(
    `SELECT
       EXISTS (SELECT 1 FROM story_views WHERE story_id = $1 AND viewer_id = $2) AS viewed_by_me,
       (SELECT COUNT(*) FROM story_views WHERE story_id = $1)                   AS view_count`,
    [s.id, viewerId]
  );
  return {
    id: s.id,
    userId: s.user_id,
    mediaUrl: s.media_url || null,
    mediaType: s.media_type || null,
    text: s.text || "",
    background: s.background,
    createdAt: toIso(s.created_at),
    expiresAt: toIso(s.expires_at),
    viewedByMe: isOwner ? true : stats.viewed_by_me,
    // Only the author gets to see how many people watched their story.
    ...(isOwner ? { viewCount: stats.view_count } : {}),
  };
}

// ---- Active stories from me + my friends, grouped per person -----------------
router.get("/", requireAuth, async (req, res) => {
  await purgeExpired();

  const me = req.user.id;
  const authorIds = [me, ...(await getFriendIds(me))];
  const rows = await many(
    `SELECT s.*, u.full_name, u.username, u.avatar
     FROM stories s JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ANY($1::int[]) AND s.expires_at > NOW()
     ORDER BY s.created_at ASC, s.id ASC`,
    [authorIds]
  );

  const groupsByUser = new Map();
  for (const row of rows) {
    if (!groupsByUser.has(row.user_id)) {
      groupsByUser.set(row.user_id, {
        user: { id: row.user_id, fullName: row.full_name, username: row.username, avatar: row.avatar },
        isMine: row.user_id === me,
        rows: [],
      });
    }
    groupsByUser.get(row.user_id).rows.push(row);
  }

  const groups = await Promise.all(
    [...groupsByUser.values()].map(async ({ rows: storyRows, ...g }) => {
      const stories = await Promise.all(storyRows.map((r) => serializeStory(r, me)));
      return {
        ...g,
        stories,
        allViewed: stories.every((s) => s.viewedByMe),
        latestAt: stories[stories.length - 1].createdAt,
      };
    })
  );

  // Own stories first, then unseen, then seen — newest activity first in each.
  groups.sort((a, b) => {
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
    return b.latestAt.localeCompare(a.latestAt);
  });

  res.json({ groups });
});

// ---- Create a story: a photo/video (optional caption) or a text card ---------
router.post("/", requireAuth, uploadStoryMedia.single("media"), async (req, res) => {
  const text = String(req.body?.text || "").trim();
  const background = STORY_BACKGROUNDS.includes(req.body?.background) ? req.body.background : "ocean";
  const file = req.file;

  if (!text && !file) {
    return res.status(400).json({ error: "A story needs a photo/video or some text." });
  }
  if (text.length > MAX_TEXT) {
    if (file) removeMediaFile({ media_url: `/uploads/stories/${file.filename}` });
    return res.status(400).json({ error: `Story text is too long (max ${MAX_TEXT} characters).` });
  }

  const mediaUrl = file ? `/uploads/stories/${file.filename}` : "";
  const type = file ? mediaType(file.filename) : "";

  const story = await one(
    `INSERT INTO stories (user_id, media_url, media_type, text, background)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.id, mediaUrl, type, text, background]
  );
  res.status(201).json({ story: await serializeStory(story, req.user.id) });
});

// ---- Mark a story as seen -----------------------------------------------------
router.post("/:id/view", requireAuth, async (req, res) => {
  const story = await one("SELECT * FROM stories WHERE id = $1", [req.params.id]);
  if (!story) return res.status(404).json({ error: "Story not found." });
  if (!(await canSee(story, req.user.id))) return res.status(403).json({ error: "Not allowed." });

  if (story.user_id !== req.user.id) {
    await one(
      `INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2)
       ON CONFLICT (story_id, viewer_id) DO NOTHING`,
      [story.id, req.user.id]
    );
  }
  res.json({ success: true });
});

// ---- Who viewed my story (author only) -------------------------------------
router.get("/:id/viewers", requireAuth, async (req, res) => {
  const story = await one("SELECT * FROM stories WHERE id = $1", [req.params.id]);
  if (!story) return res.status(404).json({ error: "Story not found." });
  if (story.user_id !== req.user.id) return res.status(403).json({ error: "Only the author can see viewers." });

  const rows = await many(
    `SELECT u.id, u.full_name, u.username, u.avatar, v.created_at
     FROM story_views v JOIN users u ON u.id = v.viewer_id
     WHERE v.story_id = $1
     ORDER BY v.created_at DESC`,
    [story.id]
  );
  const viewers = rows.map((v) => ({
    id: v.id,
    fullName: v.full_name,
    username: v.username,
    avatar: v.avatar,
    viewedAt: toIso(v.created_at),
  }));
  res.json({ viewers });
});

// ---- Delete my story ------------------------------------------------------------
router.delete("/:id", requireAuth, async (req, res) => {
  const story = await one("SELECT * FROM stories WHERE id = $1", [req.params.id]);
  if (!story) return res.status(404).json({ error: "Story not found." });
  if (story.user_id !== req.user.id) return res.status(403).json({ error: "You can't delete this story." });

  await one("DELETE FROM stories WHERE id = $1", [story.id]);
  removeMediaFile(story);
  res.json({ success: true });
});

export default router;
