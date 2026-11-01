# Connectly Backend (Tier 2: Application)

Node.js + Express 5 REST API for Connectly, backed by **PostgreSQL** (tier 3). It handles authentication, privacy rules, file uploads and all social features. In the 3 tier setup the browser never calls this API directly: the web tier (`frontend/`, port 8080) forwards `/api` and `/uploads` here.

See the root `README.md` for running all three tiers together.

## Setup

```bash
# 1. one time: create the database user and database (asks for the postgres password)
psql -U postgres -f database/create-local-db.sql

# 2. install and configure
npm install
cp .env.example .env        # Windows: copy .env.example .env

# 3. run
npm start                   # http://localhost:4000/api/health
```

On startup the API waits for PostgreSQL, creates any missing tables from `database/schema.sql`, and loads the demo accounts **only if the database is empty**. After that all data persists across restarts.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the API |
| `npm run dev` | Start the API and restart it automatically when code changes |
| `npm run db:init` | Create the tables and indexes without starting the API (keeps existing data) |
| `npm run seed` | **Wipe all data** and reload the demo accounts |
| `npm test` | 12 end to end API tests against the running API (`API_URL` defaults to `http://localhost:4000`) |

## Environment variables (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `JWT_SECRET` | a dev default | Signs the login cookie. Use a long random value outside local development |
| `CLIENT_ORIGIN` | `http://localhost:8080,http://localhost:5173` | Allowed browser origins (CORS), comma separated |
| `COOKIE_SECURE` | `false` | Set `true` only when the site is served over HTTPS |
| `TRUST_PROXY` | `true` in `.env.example` | Trust `X-Forwarded-*` headers from the web tier |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | PostgreSQL server |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `connectly` / `connectly_pass` / `connectly` | Database login |
| `DB_SSL` | `false` | Encrypted connection (required later for Amazon RDS) |
| `DATABASE_URL` | (unset) | Optional single connection string instead of the `DB_*` values |
| `STORAGE_DRIVER` | `local` | `local` saves uploads in `uploads/`; `s3` saves them in an S3 bucket (AWS) |
| `S3_BUCKET` / `AWS_REGION` | (unset) / `ap-south-1` | Bucket for `STORAGE_DRIVER=s3`. Credentials come from the EC2 instance's IAM role, never from code |
| `DEMO_MODE` | `true` locally, `false` in production | List the seeded demo accounts on the login page |

## Code structure

```
backend/
├── server.js            starts Express, checks the database, creates tables, seeds if empty
├── config.js            reads .env
├── db.js                PostgreSQL connection pool + helpers (one, many, transaction)
├── database/
│   ├── schema.sql       all 13 tables, constraints and indexes
│   ├── create-local-db.sql   one time local user + database creation
│   └── init.js          npm run db:init
├── middleware/          login check (attachUser, requireAuth)
├── routes/              auth, users, posts, comments, friends, messages, notifications, stories
├── utils/               password hashing, uploads, privacy and serialization helpers
├── seedData.js          demo accounts and content
└── tests/               end to end API tests
```

## Data model

PostgreSQL tables: `users`, `posts`, `post_media`, `comments`, `likes`, `bookmarks`, `friend_requests`, `notifications`, `messages`, `comment_likes`, `message_likes`, `stories`, `story_views`.

* Ids are `SERIAL`, times are `TIMESTAMPTZ` (stored in UTC, sent to the browser as ISO 8601), flags are `BOOLEAN`.
* Foreign keys use `ON DELETE CASCADE`, so deleting a post removes its comments, likes and media rows.
* `UNIQUE` rules stop double likes, double bookmarks and duplicate friend requests; `CHECK` rules only allow valid privacy and status values.
* There is no separate friends table: a friendship is a `friend_requests` row with `status = 'accepted'`.
* Writes that touch several tables (a post and its media, a like and its notification) run inside a single transaction.
* Stories get `expires_at = created_at + 24 hours`; expired stories and their files are removed automatically.

## Auth

`POST /api/auth/register` and `/login` set an httpOnly, `SameSite=Lax` cookie containing a signed JWT. `GET /api/auth/me` returns the current user (401 if not logged in). `POST /api/auth/logout` clears the cookie. Passwords are hashed with bcrypt.

## API reference

All routes are prefixed `/api` and require the session cookie unless noted.

**Auth**
- `POST /auth/register` `{ fullName, username, email, password, confirmPassword }`
- `POST /auth/login` `{ identifier, password }`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /health` (no login) — `{ status, database }`, confirms the API can reach PostgreSQL

**Users**
- `GET /users/search?q=` — search by name/username
- `GET /users/suggestions` — "People You May Know" (excludes existing friends/pending requests, sorted by mutual-friend count)
- `GET /users/:username` — profile + friendship status + mutual count + private-account gate
- `PUT /users/me` `{ fullName, bio, location }`
- `PUT /users/me/privacy` `{ accountVisibility: "public" | "private" }`
- `POST /users/me/avatar` / `/users/me/cover` — multipart, field name `avatar` / `cover`

**Stories** (disappear automatically after 24 hours)
- `GET /stories` — active stories from you + your friends, grouped per person (`{ groups: [{ user, isMine, allViewed, stories: [...] }] }`), yours first, then unseen
- `POST /stories` — multipart: optional `media` (one photo/video), `text` (caption or text-card, max 300), `background` (`ocean`, `sunset`, `forest`, `grape`, `night`, `rose`)
- `POST /stories/:id/view` — mark as seen
- `GET /stories/:id/viewers` — who watched it (author only)
- `DELETE /stories/:id` — author only; also deletes the uploaded file

**Posts**
- `GET /posts/feed` — self + friends' posts, privacy-filtered, newest first
- `GET /posts/explore` — public posts platform-wide
- `GET /posts/user/:userId` — a specific user's posts, privacy-filtered
- `GET /posts/bookmarks` — posts you've bookmarked
- `POST /posts` — multipart: `text`, `privacy`, up to 4 files under `media`
- `DELETE /posts/:id` — owner only
- `POST /posts/:id/like` — toggle, returns `{ liked, likeCount }`
- `POST /posts/:id/bookmark` — toggle, returns `{ bookmarked }`
- `GET /posts/:id/comments`
- `POST /posts/:id/comments` `{ text, parentId? }`
- `DELETE /comments/:commentId` — comment author or post owner
- `POST /comments/:commentId/like` — toggle, returns `{ liked, likeCount }` (notifies the comment's author)

**Friends**
- `GET /friends/status/:userId`
- `GET /friends/incoming` / `/sent` / `/list` — pending-received, pending-sent, accepted friends (all for the logged-in user)
- `GET /friends/of/:userId` — another user's friends list (403 if their account is private and you're not a friend)
- `POST /friends/request/:userId` / `/cancel/:userId` / `/accept/:userId` / `/reject/:userId` / `/remove/:userId`

**Messages** (friends only)
- `GET /messages/conversations` — every friend with last message + unread count (newest conversation first)
- `GET /messages/:userId` — the most recent 200 messages with that friend, oldest first (each carries `likeCount` / `likedByMe`)
- `POST /messages/:userId` `{ text }` — send (also notifies the recipient)
- `POST /messages/:userId/read` — mark that friend's messages as read
- `POST /messages/like/:messageId` — toggle a like on a message (either participant), returns `{ liked, likeCount }`

**Notifications**
- `GET /notifications`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`

Uploaded files are served statically from `/uploads/...`.
