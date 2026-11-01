# Connectly: a 3 Tier Social Networking Web Application

Connectly is a full stack social network (posts, 24 hour stories, likes, comments, friend requests, private messages, notifications, profiles and privacy settings) built as a classic **3 tier architecture**. Each tier runs as its own separate process and only talks to the tier next to it.

| Tier | Technology | Folder | Runs on (local) |
|---|---|---|---|
| **1. Web (presentation)** | React 19 + Vite + Tailwind CSS. Serves the built site and forwards `/api` and `/uploads` to tier 2 | `frontend/` | <http://localhost:8080> |
| **2. Application (logic)** | Node.js + Express 5 REST API: login, privacy rules, uploads | `backend/` | <http://localhost:4000> |
| **3. Data** | PostgreSQL, 13 tables | `backend/database/` | `localhost:5432` |

```
 Browser ──▶ Tier 1: Web (port 8080) ──/api, /uploads──▶ Tier 2: API (port 4000) ──SQL──▶ Tier 3: PostgreSQL (port 5432)
            serves the React build                      Express + Node.js                 users, posts, stories ...
```

The browser **only** talks to the web tier. It never connects to the API or the database directly. This is the same layout that will be used on AWS later (Nginx on the web tier, EC2 for the API, Amazon RDS for PostgreSQL).

```
Connectly-FullStack/
├── frontend/              Tier 1: React app + web tier server (vite.config.js)
├── backend/               Tier 2: Express API
│   ├── database/          Tier 3: schema.sql, create-local-db.sql, init.js
│   ├── routes/            one file per feature (auth, posts, stories, ...)
│   ├── uploads/           uploaded photos and videos
│   └── tests/             end to end API tests (npm test)
├── frontend/Dockerfile    Tier 1 image: React build served by Nginx (frontend/nginx/)
├── backend/Dockerfile     Tier 2 image: Node.js API
└── docker-compose.yml     all three tiers as containers (one command)
```

---

## Option A: run everything with Docker (one command)

Needs only **Docker Desktop** (no Node.js or PostgreSQL install).

```bash
docker compose up --build
```

The first build takes a few minutes. When the log shows `Connectly API running on port 4000`, open **<http://localhost:8080>** and log in with a demo account.

| Container | Tier | Reachable from |
|---|---|---|
| `connectly-web-1` | 1. Nginx + React build | your browser, port 8080 |
| `connectly-app-1` | 2. Node.js API | only the web container |
| `connectly-db-1` | 3. PostgreSQL 16 | only the app container |

```bash
docker compose ps                 # all three should be "healthy"
docker compose logs -f app        # follow the API log
docker compose down               # stop (database and uploads are kept)
docker compose down -v            # stop and DELETE all data
```

Close anything else using port 8080 first (for example `npm start` in `frontend/`).

---

## Option B: run without Docker

## Requirements

* **Node.js 22 LTS** (20.12 or newer works). Check with `node --version`.
* **PostgreSQL 14 or newer** (16 recommended).

---

## Run the 3 tier app locally

You will use **three things at the same time**: the PostgreSQL service, and two terminals (one for the API, one for the web tier).

### Step 1. Tier 3: install PostgreSQL and create the database (one time only)

**Install PostgreSQL**

* **Windows:** download the installer from <https://www.postgresql.org/download/windows/> and run it. Keep the default port **5432** and **remember the password** you choose for the `postgres` user. PostgreSQL then runs automatically in the background as a Windows service.
* **macOS:** `brew install postgresql@16 && brew services start postgresql@16` (or install Postgres.app).
* **Ubuntu:** `sudo apt install postgresql`

**Create the Connectly user and database**

```bash
cd backend
psql -U postgres -f database/create-local-db.sql
```

It asks for the `postgres` password you set during installation.

* **Windows: "psql is not recognized"?** Open **SQL Shell (psql)** from the Start menu instead, press Enter for every question except the password, then run:
  ```sql
  CREATE USER connectly WITH PASSWORD 'connectly_pass';
  CREATE DATABASE connectly OWNER connectly;
  ```
  (You can also paste these two lines into the Query Tool in **pgAdmin**.)
* **macOS (Homebrew):** Homebrew uses your Mac username as the admin, so run `psql postgres -f database/create-local-db.sql`.
* **Ubuntu:** `sudo -u postgres psql -f database/create-local-db.sql`

You do **not** need to create any tables. The API creates them automatically.

### Step 2. Tier 2: start the API (terminal 1)

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```

You should see:

```
Empty database — loading demo data (one-time)…
...
Connectly API running on port 4000
```

On the first start the API creates all 13 tables and loads the demo accounts. Check that tier 2 can reach tier 3 by opening <http://localhost:4000/api/health>:

```json
{"status":"ok","database":"connected"}
```

Leave this terminal running.

### Step 3. Tier 1: build and start the web tier (terminal 2)

```bash
cd frontend
npm install
npm run build
npm start
```

Now open **<http://localhost:8080>** and log in with a demo account. Leave this terminal running too.

> Always open the site on **port 8080** (the web tier). Port 4000 is only the API.

### Every time after the first setup

PostgreSQL keeps running in the background, so you only need:

```bash
# terminal 1
cd backend  && npm start
# terminal 2
cd frontend && npm start          # run "npm run build" first if you changed frontend code
```

### Development mode (optional)

While editing frontend code you can use `npm run dev` in `frontend/` instead. It opens <http://localhost:5173> with instant reload, and it also forwards `/api` to the API, so it works the same way.

---

## Demo accounts

All use the password **`Passw0rd!`** (you can also type the username with `@`, for example `@neha.joshi`).

| Username | Name |
|---|---|
| `anmol.sharma` | Anmol Sharma |
| `priya.nair` | Priya Nair |
| `rohan.verma` | Rohan Verma |
| `aisha.khan` | Aisha Khan |
| `karan.mehta` | Karan Mehta |
| `vikram.rao` | Vikram Rao |
| `arjun.malhotra` | Arjun Malhotra |
| `sana.sheikh` | Sana Sheikh |
| `neha.joshi` | Neha Joshi |

Everything you create (accounts, posts, stories, messages) is saved in PostgreSQL and stays after restarts. To wipe everything and reload the demo data: `cd backend && npm run seed`.

---

## Look inside the database

```bash
psql -h localhost -U connectly -d connectly          # password: connectly_pass
```

```sql
\dt                                     -- list the 13 tables
SELECT id, username, full_name FROM users;
SELECT id, user_id, text, created_at FROM posts ORDER BY id DESC LIMIT 5;
SELECT * FROM stories;
\q
```

Or connect with **pgAdmin**: host `localhost`, port `5432`, database `connectly`, user `connectly`, password `connectly_pass`.

---

## Tests

```bash
cd frontend && npm test     # 27 UI tests (Vitest + React Testing Library)
cd backend  && npm test     # 12 end to end API tests (the API must be running)
```

The API tests create throwaway accounts (named `t_...`), so run them against your local database only.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `password authentication failed for user "connectly"` | The database user was not created, or the password differs. Repeat Step 1, or update `DB_PASSWORD` in `backend/.env`. |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running. Windows: open **Services** and start `postgresql-x64-16`. macOS: `brew services start postgresql@16`. Ubuntu: `sudo systemctl start postgresql`. |
| `database "connectly" does not exist` | Run Step 1 again. |
| The site loads but login or every action fails | The API (terminal 1) is not running. Start it and check <http://localhost:4000/api/health>. |
| `Port 8080 is in use` | Close the other program on that port, or run `npx vite preview --port 8081` and open that port instead. |
| Changes to frontend code don't show on port 8080 | Run `npm run build` again, then `npm start`. |

---

## Features

* Register and log in (bcrypt password hashing, JWT in an httpOnly cookie)
* Home feed of your own and your friends' posts; Explore for public posts
* Posts with up to 4 photos or a video, feeling, location and privacy (public, friends, only me)
* Stories (photo, video or text) that disappear after 24 hours, with view counts and viewer list
* Likes, comments, replies, comment likes, bookmarks
* Friend requests (send, cancel, accept, reject, remove) and "People You May Know"
* Private messaging between friends, with read status and message likes
* Notifications with filters and mark as read
* Profile with avatar and cover upload, private accounts enforced by the server
* Light and dark mode, responsive layout

---

## Next step: AWS

The containers above are exactly what runs on AWS; only where each tier runs changes:

| Tier | Local (Docker) | AWS |
|---|---|---|
| 1. Web | `web` container | Same image on EC2 in an Auto Scaling group behind an Application Load Balancer (public subnets) |
| 2. App | `app` container | Same image on EC2 in a private subnet, uploads stored in a private S3 bucket (`STORAGE_DRIVER=s3`) |
| 3. Data | `db` container | Amazon RDS for PostgreSQL in private database subnets (`DB_SSL=true`) |

No application code changes between the two, only environment variables.
