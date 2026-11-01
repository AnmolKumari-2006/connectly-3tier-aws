-- ============================================================================
--  Connectly — PostgreSQL schema (data tier)
--
--  Safe to run any number of times: every statement uses IF NOT EXISTS.
--  The API server runs this file automatically on startup, so you normally
--  never need to run it by hand. To apply it manually (e.g. on Amazon RDS):
--
--    psql -h <rds-endpoint> -U connectly -d connectly -f database/schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  full_name          VARCHAR(100) NOT NULL,
  username           VARCHAR(30)  NOT NULL UNIQUE,
  email              VARCHAR(255) NOT NULL UNIQUE,
  password_hash      TEXT         NOT NULL,
  avatar             TEXT         NOT NULL DEFAULT '',
  cover              TEXT         NOT NULL DEFAULT '',
  bio                TEXT         NOT NULL DEFAULT '',
  location           VARCHAR(100) NOT NULL DEFAULT '',
  account_visibility VARCHAR(10)  NOT NULL DEFAULT 'public'
                     CHECK (account_visibility IN ('public', 'private')),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT        NOT NULL DEFAULT '',
  privacy    VARCHAR(10) NOT NULL DEFAULT 'public'
             CHECK (privacy IN ('public', 'friends', 'only_me')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_media (
  id       SERIAL PRIMARY KEY,
  post_id  INTEGER     NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url      TEXT        NOT NULL,
  type     VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
  position INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER     NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  INTEGER     REFERENCES comments(id) ON DELETE CASCADE,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS likes (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER     NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER     NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

-- A friendship is simply a request whose status is 'accepted'.
CREATE TABLE IF NOT EXISTS friend_requests (
  id           SERIAL PRIMARY KEY,
  sender_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(10) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (sender_id, receiver_id),
  CHECK (sender_id <> receiver_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id                SERIAL PRIMARY KEY,
  recipient_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id          INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              VARCHAR(20) NOT NULL,
  post_id           INTEGER     REFERENCES posts(id) ON DELETE CASCADE,
  friend_request_id INTEGER     REFERENCES friend_requests(id) ON DELETE CASCADE,
  is_read           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  sender_id   INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_likes (
  id         SERIAL PRIMARY KEY,
  comment_id INTEGER     NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_likes (
  id         SERIAL PRIMARY KEY,
  message_id INTEGER     NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

-- Stories disappear 24 hours after they are posted.
CREATE TABLE IF NOT EXISTS stories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url  TEXT        NOT NULL DEFAULT '',
  media_type VARCHAR(10) NOT NULL DEFAULT '',
  text       TEXT        NOT NULL DEFAULT '',
  background VARCHAR(20) NOT NULL DEFAULT 'ocean',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE TABLE IF NOT EXISTS story_views (
  id         SERIAL PRIMARY KEY,
  story_id   INTEGER     NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, viewer_id)
);

-- ---- Indexes for the most common lookups -------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_user          ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created       ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_media_post     ON post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post       ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post          ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user      ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_fr_sender           ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_fr_receiver         ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notif_recipient     ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pair       ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver   ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_cmt   ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_message_likes_msg   ON message_likes(message_id);
CREATE INDEX IF NOT EXISTS idx_stories_user        ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires     ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_story_views_story   ON story_views(story_id);

-- ============================================================================
--  Version 2 additions. Written as ALTER ... IF NOT EXISTS so an existing
--  database is upgraded in place on the next server start, without losing data.
-- ============================================================================

-- ---- Profile, privacy and notification settings ------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_post_privacy VARCHAR(10) NOT NULL DEFAULT 'friends'
  CHECK (default_post_privacy IN ('public', 'friends', 'only_me'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_activity BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_email    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_likes           BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_comments        BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_friend_requests BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_messages        BOOLEAN NOT NULL DEFAULT TRUE;

-- ---- Two factor authentication (TOTP, e.g. Google Authenticator) -----------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Accounts created by the demo seed (listed on the login page in demo mode).
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- ---- Post extras --------------------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS feeling  VARCHAR(40)  NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS location VARCHAR(100) NOT NULL DEFAULT '';

-- ---- Login sessions: one row per signed in browser/device ------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id           VARCHAR(64) PRIMARY KEY,
  user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent   TEXT        NOT NULL DEFAULT '',
  ip           VARCHAR(64) NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
