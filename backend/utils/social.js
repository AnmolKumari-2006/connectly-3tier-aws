import { one, many, query } from "../db.js";

// PostgreSQL TIMESTAMPTZ columns come back as JS Date objects. Send them to
// the browser as unambiguous ISO 8601 UTC strings ("2026-10-26T09:15:00.000Z")
// so every client shows the correct local time.
export function toIso(value) {
  if (!value) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

/** Promise-based filter: keeps items whose async predicate resolves to true. */
export async function filterAsync(items, predicate) {
  const keep = await Promise.all(items.map(predicate));
  return items.filter((_, i) => keep[i]);
}

export const findUserById = (id) => one("SELECT * FROM users WHERE id = $1", [id]);

function authorSummary(u) {
  return u ? { id: u.id, fullName: u.full_name, username: u.username, avatar: u.avatar } : null;
}

// ---- Serialization -------------------------------------------------------
export async function publicUser(row, { includeEmail = false } = {}) {
  if (!row) return null;
  const [{ c: postCount }, friendIds] = await Promise.all([
    one("SELECT COUNT(*) AS c FROM posts WHERE user_id = $1", [row.id]),
    getFriendIds(row.id),
  ]);

  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    ...(includeEmail ? { email: row.email } : {}),
    avatar: row.avatar,
    cover: row.cover,
    bio: row.bio,
    location: row.location,
    accountVisibility: row.account_visibility,
    createdAt: toIso(row.created_at),
    stats: { posts: postCount, friends: friendIds.length },
  };
}

/** The logged in user's own profile, including their private settings. */
export async function selfUser(row) {
  if (!row) return null;
  return {
    ...(await publicUser(row, { includeEmail: true })),
    birthday: formatDateOnly(row.birthday),
    settings: {
      defaultPostPrivacy: row.default_post_privacy,
      showActivity: row.show_activity,
      showEmail: row.show_email,
      notifications: {
        likes: row.notify_likes,
        comments: row.notify_comments,
        friendRequests: row.notify_friend_requests,
        messages: row.notify_messages,
      },
      twoFactorEnabled: row.two_factor_enabled,
    },
  };
}

/** "YYYY-MM-DD" for a DATE column (pg returns it as a local-midnight Date). */
export function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Online status as shown to friends. Returns null when the person turned
 * "Show activity status" off, so nobody can see it.
 */
export function presenceOf(row) {
  if (!row || !row.show_activity) return null;
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at) : null;
  return {
    online: !!lastSeen && Date.now() - lastSeen.getTime() < ONLINE_WINDOW_MS,
    lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
  };
}

// ---- Friend graph ----------------------------------------------------------
export async function getFriendIds(userId) {
  const rows = await many(
    `SELECT sender_id, receiver_id FROM friend_requests
     WHERE status = 'accepted' AND (sender_id = $1 OR receiver_id = $1)`,
    [userId]
  );
  return rows.map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id));
}

export async function friendshipStatus(viewerId, otherId) {
  if (viewerId === otherId) return "self";

  // Accepted rows sort before pending ones, mirroring the original logic
  // ("friends" wins over a stray pending request).
  const row = await one(
    `SELECT sender_id, status FROM friend_requests
     WHERE status IN ('accepted', 'pending')
       AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
     ORDER BY (status = 'accepted') DESC
     LIMIT 1`,
    [viewerId, otherId]
  );
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.sender_id === viewerId ? "request_sent" : "request_received";
}

export async function mutualFriendsCount(aId, bId) {
  const [aFriends, bFriends] = await Promise.all([getFriendIds(aId), getFriendIds(bId)]);
  const set = new Set(aFriends);
  return bFriends.filter((id) => set.has(id)).length;
}

export async function isFriendsWith(aId, bId) {
  return (await friendshipStatus(aId, bId)) === "friends";
}

// ---- Post visibility --------------------------------------------------------
// Enforced on the server for every endpoint that returns posts.
export async function postVisibleTo(post, viewerId) {
  if (viewerId && post.user_id === viewerId) return true;

  const author = await findUserById(post.user_id);
  if (!author) return false;

  if (author.account_visibility === "private") {
    if (!viewerId || !(await isFriendsWith(viewerId, author.id))) return false;
  }

  if (post.privacy === "public") return true;
  if (post.privacy === "only_me") return false;
  if (post.privacy === "friends") return viewerId ? isFriendsWith(viewerId, author.id) : false;
  return false;
}

export async function attachMedia(post) {
  const media = await many(
    "SELECT url, type FROM post_media WHERE post_id = $1 ORDER BY position ASC, id ASC",
    [post.id]
  );
  return {
    images: media.filter((m) => m.type === "image").map((m) => m.url),
    video: media.find((m) => m.type === "video")?.url || null,
  };
}

export async function serializePost(post, viewerId) {
  const [author, { images, video }, stats, likedAvatars] = await Promise.all([
    findUserById(post.user_id),
    attachMedia(post),
    // All four counters/flags in a single round trip to the database.
    one(
      `SELECT
         (SELECT COUNT(*) FROM likes    WHERE post_id = $1)                    AS like_count,
         (SELECT COUNT(*) FROM comments WHERE post_id = $1)                    AS comment_count,
         EXISTS (SELECT 1 FROM likes     WHERE post_id = $1 AND user_id = $2) AS liked_by_me,
         EXISTS (SELECT 1 FROM bookmarks WHERE post_id = $1 AND user_id = $2) AS bookmarked_by_me`,
      [post.id, viewerId ?? null]
    ),
    many(
      `SELECT u.avatar FROM likes l JOIN users u ON u.id = l.user_id
       WHERE l.post_id = $1 ORDER BY l.created_at DESC, l.id DESC LIMIT 3`,
      [post.id]
    ),
  ]);

  return {
    id: post.id,
    authorId: post.user_id,
    author: authorSummary(author),
    text: post.text,
    feeling: post.feeling || "",
    location: post.location || "",
    privacy: post.privacy,
    images,
    video: video ? { poster: video } : null,
    createdAt: toIso(post.created_at),
    likeCount: stats.like_count,
    commentCount: stats.comment_count,
    likedByMe: stats.liked_by_me,
    bookmarkedByMe: stats.bookmarked_by_me,
    likedAvatars: likedAvatars.map((r) => r.avatar),
  };
}

/** Filter a list of post rows by privacy, then serialize the visible ones. */
export async function visiblePosts(rows, viewerId) {
  const visible = await filterAsync(rows, (p) => postVisibleTo(p, viewerId));
  return Promise.all(visible.map((p) => serializePost(p, viewerId)));
}

export async function serializeComment(c, viewerId = null) {
  const [author, stats] = await Promise.all([
    findUserById(c.user_id),
    one(
      `SELECT
         (SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1)                    AS like_count,
         EXISTS (SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2)  AS liked_by_me`,
      [c.id, viewerId ?? null]
    ),
  ]);
  return {
    likeCount: stats.like_count,
    likedByMe: stats.liked_by_me,
    id: c.id,
    postId: c.post_id,
    parentId: c.parent_id,
    text: c.text,
    createdAt: toIso(c.created_at),
    author: authorSummary(author),
  };
}

export async function serializeMessage(m, viewerId = null) {
  const stats = await one(
    `SELECT
       (SELECT COUNT(*) FROM message_likes WHERE message_id = $1)                    AS like_count,
       EXISTS (SELECT 1 FROM message_likes WHERE message_id = $1 AND user_id = $2)  AS liked_by_me`,
    [m.id, viewerId ?? null]
  );
  return {
    likeCount: stats.like_count,
    likedByMe: stats.liked_by_me,
    id: m.id,
    senderId: m.sender_id,
    receiverId: m.receiver_id,
    text: m.text,
    isRead: m.is_read,
    createdAt: toIso(m.created_at),
  };
}

// ---- Notifications ----------------------------------------------------------
const NOTIF_MESSAGES = {
  like: "liked your post",
  comment: "commented on your post",
  friend_request: "sent you a friend request",
  friend_accept: "accepted your friend request",
  message: "sent you a message",
  comment_like: "liked your comment",
};

// Which user setting controls each notification type (Settings > Notifications).
const PREF_FOR_TYPE = {
  like: "notify_likes",
  comment_like: "notify_likes",
  comment: "notify_comments",
  friend_request: "notify_friend_requests",
  friend_accept: "notify_friend_requests",
  message: "notify_messages",
};

export async function createNotification({ recipientId, actorId, type, postId = null, friendRequestId = null }, client) {
  if (recipientId === actorId) return null; // never notify yourself

  // Respect the recipient's notification settings.
  const pref = PREF_FOR_TYPE[type];
  if (pref) {
    const recipient = await one(`SELECT ${pref} AS wanted FROM users WHERE id = $1`, [recipientId], client);
    if (!recipient || !recipient.wanted) return null;
  }
  const row = await one(
    `INSERT INTO notifications (recipient_id, actor_id, type, post_id, friend_request_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [recipientId, actorId, type, postId, friendRequestId],
    client
  );
  return row.id;
}

export async function serializeNotification(n) {
  const actor = await findUserById(n.actor_id);
  return {
    id: n.id,
    type: n.type,
    message: NOTIF_MESSAGES[n.type] || "interacted with you",
    postId: n.post_id,
    friendRequestId: n.friend_request_id,
    isRead: n.is_read,
    createdAt: toIso(n.created_at),
    actor: authorSummary(actor),
  };
}

// Re-exported so routes can import every data helper from one place.
export { one, many, query };
