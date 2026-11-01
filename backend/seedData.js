/**
 * Demo-data loader for Connectly's backend.
 * Wipes all tables, then creates realistic demo users, posts
 * (a natural mix of text-only quotes, photo posts, and one video post per
 * "natural feel" account), friendships, pending requests, comments, likes
 * and notifications.
 *
 * Used two ways (see server.js and seed.js):
 *  - automatically on first start, ONLY when the database is empty
 *  - manually via `npm run seed` to deliberately reset back to demo state
 */
import { transaction } from "./db.js";
import { hashPassword } from "./utils/auth.js";

export const DEMO_PASSWORD = "Passw0rd!";
const img = (seed) => `https://images.unsplash.com/${seed}?w=1200&h=900&fit=crop&q=80`;
const daysAgoDate = (days) => new Date(Date.now() - days * 86400000);

// Every helper below receives `c`, the transaction client, so the whole seed
// either completes fully or leaves the database untouched.
let c;
const q = (text, params = []) => c.query(text, params);
const first = async (text, params = []) => (await c.query(text, params)).rows[0] ?? null;

async function reset() {
  // TRUNCATE ... RESTART IDENTITY also resets every SERIAL id back to 1.
  await q(`
    TRUNCATE sessions, story_views, stories, message_likes, messages, comment_likes,
             bookmarks, notifications, friend_requests, likes, comments,
             post_media, posts, users
    RESTART IDENTITY CASCADE
  `);
}

// A birthday `daysFromNow` days ahead for someone turning `age`, as "YYYY-MM-DD".
// Relative to the seed date so the "Upcoming birthdays" card always has data.
function birthdayIn(daysFromNow, age) {
  const d = new Date(Date.now() + daysFromNow * 86400000);
  const y = d.getFullYear() - age;
  return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function insertUser(u, passwordHash) {
  const row = await first(
    `INSERT INTO users (full_name, username, email, password_hash, avatar, cover, bio, location,
                        account_visibility, birthday, is_demo, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW() - INTERVAL '2 hours') RETURNING id`,
    [u.fullName, u.username, u.email, passwordHash, u.avatar, u.cover, u.bio, u.location,
     u.visibility || "public", u.birthday || null]
  );
  return row.id;
}

async function insertPost(userId, { text = "", privacy = "public", images = [], video = null, daysAgo = 0, feeling = "", location = "" }) {
  const { id: postId } = await first(
    "INSERT INTO posts (user_id, text, privacy, created_at, feeling, location) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [userId, text, privacy, daysAgoDate(daysAgo), feeling, location]
  );

  for (const [i, url] of images.entries()) {
    await q("INSERT INTO post_media (post_id, url, type, position) VALUES ($1, $2, 'image', $3)", [postId, url, i]);
  }
  if (video) {
    await q("INSERT INTO post_media (post_id, url, type, position) VALUES ($1, $2, 'video', 0)", [postId, video]);
  }
  return postId;
}

async function friend(aId, bId, daysAgo = 5) {
  const at = daysAgoDate(daysAgo);
  await q(
    "INSERT INTO friend_requests (sender_id, receiver_id, status, created_at, responded_at) VALUES ($1, $2, 'accepted', $3, $3)",
    [aId, bId, at]
  );
}

async function pendingRequest(senderId, receiverId, daysAgo = 1) {
  const at = daysAgoDate(daysAgo);
  const { id } = await first(
    "INSERT INTO friend_requests (sender_id, receiver_id, status, created_at) VALUES ($1, $2, 'pending', $3) RETURNING id",
    [senderId, receiverId, at]
  );
  await q(
    "INSERT INTO notifications (recipient_id, actor_id, type, friend_request_id, created_at) VALUES ($1, $2, 'friend_request', $3, $4)",
    [receiverId, senderId, id, at]
  );
  return id;
}

async function like(postId, userId, notifyOwner = true) {
  await q("INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING", [postId, userId]);
  if (notifyOwner) {
    const post = await first("SELECT user_id FROM posts WHERE id = $1", [postId]);
    if (post && post.user_id !== userId) {
      await q("INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES ($1, $2, 'like', $3)", [
        post.user_id,
        userId,
        postId,
      ]);
    }
  }
}

async function comment(postId, userId, text, notifyOwner = true) {
  await q("INSERT INTO comments (post_id, user_id, text) VALUES ($1, $2, $3)", [postId, userId, text]);
  if (notifyOwner) {
    const post = await first("SELECT user_id FROM posts WHERE id = $1", [postId]);
    if (post && post.user_id !== userId) {
      await q("INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES ($1, $2, 'comment', $3)", [
        post.user_id,
        userId,
        postId,
      ]);
    }
  }
}

async function run() {
  console.log("Resetting database...");
  await reset();
  // All demo accounts share one password, so hash it once.
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const ids = {};

  ids.anmol = await insertUser({
    fullName: "Anmol Sharma",
    username: "anmol.sharma",
    birthday: birthdayIn(120, 24),
    email: "anmol@example.com",
    avatar: "https://i.pravatar.cc/300?img=44",
    cover: img("photo-1519681393784-d120267933ba"),
    bio: "Building Connectly 🚀 Frontend engineer who cares about the small details.",
    location: "Bengaluru, India",
  }, passwordHash);

  ids.priya = await insertUser({
    fullName: "Priya Nair",
    username: "priya.nair",
    birthday: birthdayIn(3, 27),
    email: "priya@example.com",
    avatar: "https://i.pravatar.cc/300?img=47",
    cover: img("photo-1470252649378-9c29740c9fa8"),
    bio: "UX designer. Coffee-powered. Sketching interfaces since 2016.",
    location: "Mumbai, India",
  }, passwordHash);

  ids.rohan = await insertUser({
    fullName: "Rohan Verma",
    username: "rohan.verma",
    birthday: birthdayIn(17, 29),
    email: "rohan@example.com",
    avatar: "https://i.pravatar.cc/300?img=12",
    cover: img("photo-1501854140801-50d01698950b"),
    bio: "Photographer chasing golden hour. Nikon over phone, always.",
    location: "Manali, India",
  }, passwordHash);

  ids.aisha = await insertUser({
    fullName: "Aisha Khan",
    username: "aisha.khan",
    email: "aisha@example.com",
    avatar: "https://i.pravatar.cc/300?img=32",
    cover: img("photo-1465101162946-4377e57745c3"),
    bio: "Product manager at a startup you haven't heard of yet.",
    location: "Delhi, India",
  }, passwordHash);

  ids.karan = await insertUser({
    fullName: "Karan Mehta",
    username: "karan.mehta",
    birthday: birthdayIn(45, 30),
    email: "karan@example.com",
    avatar: "https://i.pravatar.cc/300?img=51",
    cover: img("photo-1483058712412-4245e9b90334"),
    bio: "Backend engineer. I turn coffee into APIs.",
    location: "Pune, India",
  }, passwordHash);

  ids.vikram = await insertUser({
    fullName: "Vikram Rao",
    username: "vikram.rao",
    email: "vikram@example.com",
    avatar: "https://i.pravatar.cc/300?img=14",
    cover: img("photo-1476242906366-d8eb64c2f661"),
    bio: "Runner. Reader. Occasionally both at once.",
    location: "Chennai, India",
  }, passwordHash);

  ids.arjun = await insertUser({
    fullName: "Arjun Malhotra",
    username: "arjun.malhotra",
    email: "arjun@example.com",
    avatar: "https://i.pravatar.cc/300?img=60",
    cover: img("photo-1520962880247-cfaf541c8724"),
    bio: "Founder, two-person startup. Building in public.",
    location: "Gurugram, India",
  }, passwordHash);

  // ---- The two "natural feel" accounts: a steady mix of quotes, photos
  // and one video-style post each, like a real, lived-in profile. ----------
  ids.sana = await insertUser({
    fullName: "Sana Sheikh",
    username: "sana.sheikh",
    birthday: birthdayIn(9, 25),
    email: "sana@example.com",
    avatar: "https://i.pravatar.cc/300?img=25",
    cover: img("photo-1500534623283-312aade485b7"),
    bio: "Marketing lead · dogs, hiking and a good playlist 🎧",
    location: "Hyderabad, India",
  }, passwordHash);

  ids.neha = await insertUser({
    fullName: "Neha Joshi",
    username: "neha.joshi",
    birthday: birthdayIn(24, 26),
    email: "neha@example.com",
    avatar: "https://i.pravatar.cc/300?img=45",
    cover: img("photo-1499092346589-b9b6be3e94b2"),
    bio: "Illustrator & motion designer. I draw things that move.",
    location: "Ahmedabad, India",
  }, passwordHash);

  console.log("Creating posts...");

  // --- Regular users: a couple of posts each, mirroring the frontend mock feed ---
  await insertPost(ids.anmol, { text: "Shipped the new Connectly onboarding flow today — three weeks of iteration finally clicked into place. Small wins add up 🚀 #ConnectlyLaunch #BuildInPublic", daysAgo: 0.3, feeling: "😄 proud" });
  await insertPost(ids.anmol, { text: "Note to self: refactor the onboarding flow copy before next sprint review.", privacy: "only_me", daysAgo: 1 });

  await insertPost(ids.rohan, { text: "Golden hour over the Manali ridgeline. Waited two hours for this light and it was worth every minute. #Photography #GoldenHour", location: "Manali, India", images: [img("photo-1506905925346-21bda4d32df4")], daysAgo: 0.6 });
  await insertPost(ids.rohan, { text: "Street photography walk through the old city today. Every alley had a different color temperature. #Photography", images: [img("photo-1477959858617-67f85cf4f1df"), img("photo-1449824913935-59a10b8d2000"), img("photo-1519098901909-b1553a1190af")], daysAgo: 3 });

  await insertPost(ids.priya, { text: "Redesigned my portfolio this weekend. Went with a much quieter type system — feedback very welcome before I push it live. #DesignSystems", privacy: "friends", images: [img("photo-1467232004584-a241de8bcf5d"), img("photo-1522542550221-31fd19575a2d")], daysAgo: 1.5 });
  await insertPost(ids.priya, { text: "Grateful for good friends, good weather and a slow Sunday. Sometimes that's the whole post.", images: [img("photo-1529156069898-49953e39b3ac")], daysAgo: 6 });

  await insertPost(ids.karan, { text: "Flask + SQLAlchemy is such a productive combo for weekend projects. Sometimes the boring stack is the right stack.", daysAgo: 1.8 });
  await insertPost(ids.karan, { text: "Anyone else migrating side projects to the newest Python release this week?", daysAgo: 5.4 });
  await insertPost(ids.karan, { text: "Working from a new coffee shop today — surprisingly great wifi and even better cold brew. #RemoteWork", feeling: "☕ relaxed", images: ["/uploads/posts/seed-cafe-interior.png"], daysAgo: 0.7 });

  await insertPost(ids.aisha, { text: "Three things that changed how I run product reviews this quarter: fewer meetings, sharper docs, faster decisions. #ProductManagement #BuildInPublic", daysAgo: 2.4 });

  await insertPost(ids.vikram, { text: "Currently reading four books at once, which is either impressive time management or a sign I can't commit to anything.", daysAgo: 3.2 });

  await insertPost(ids.arjun, { text: "Two-person startup update: we shipped our first paying customer today. Building in public has been terrifying and clarifying in equal measure. #BuildInPublic #Startups", images: [img("photo-1454165804606-c3d57bc86b40")], daysAgo: 4.2 });
  await insertPost(ids.arjun, { text: "starting a new account with 0 followers and posting anything cause who cares!!", images: ["/uploads/posts/seed-new-account-quote.png"], daysAgo: 2.5 });
  await insertPost(ids.arjun, { text: "Evening walk to clear my head before tomorrow's investor call.", images: ["/uploads/posts/seed-shadow-selfie.png"], daysAgo: 1.1 });

  // --- Sana: quotes + photos + one video-style post, a believable rhythm ---
  await insertPost(ids.sana, { text: "“Discipline is choosing between what you want now and what you want most.” — a note to myself before this morning's run.", daysAgo: 0.2 });
  await insertPost(ids.sana, { text: "Finished a 10k trail run this morning with the worst possible playlist shuffle. Legs are jelly, heart is full. 😅 #WeekendHikes #Running", feeling: "💪 energized", images: [img("photo-1502904550040-7534597429ae")], daysAgo: 0.9 });
  await insertPost(ids.sana, { text: "Weekend market haul: fresh basil, three kinds of chili, and a very stubborn negotiation over mangoes.", images: [img("photo-1467003909585-2f8a72700288"), img("photo-1542838132-92c53300491e"), img("photo-1506484381205-f7945653044d"), img("photo-1518977676601-b53f82aba655")], daysAgo: 2.1 });
  await insertPost(ids.sana, { text: "“You don't have to see the whole staircase, just take the first step.” Starting a new campaign brief today.", daysAgo: 3.6 });
  await insertPost(ids.sana, { text: "A little behind-the-scenes from today's shoot — the good takes always happen after everyone stops posing.", video: img("photo-1489599849927-2ee91cede3ba"), daysAgo: 5.1 });
  await insertPost(ids.sana, { text: "Dogs, hiking boots, and a playlist that finally makes sense. Sunday reset complete. #WeekendHikes", images: [img("photo-1544568100-847a948585b9")], daysAgo: 7.3 });

  // --- Neha: same natural rhythm — quotes, art process shots, one video post ---
  await insertPost(ids.neha, { text: "“Creativity is intelligence having fun.” Pinning this above my desk for the rest of the year.", daysAgo: 0.4 });
  await insertPost(ids.neha, { text: "New illustration study — everything hand-drawn frame by frame, no rigs, just patience. #Illustration #DesignSystems", video: img("photo-1513364776144-60967b0f800f"), daysAgo: 1.3 });
  await insertPost(ids.neha, { text: "Studio corner today: bad lighting, good tea, better ideas.", images: [img("photo-1513364776144-60967b0f800f"), img("photo-1522199873717-bc67b1a5e32e")], daysAgo: 2.8 });
  await insertPost(ids.neha, { text: "“Done is better than perfect” has been my whole month, honestly.", daysAgo: 4.5 });
  await insertPost(ids.neha, { text: "Client project wrapped — six weeks of revisions distilled into four final frames.", images: [img("photo-1561070791-2526d30994b5")], daysAgo: 6.7 });

  console.log("Creating friendships...");
  // Distinct, realistic circles rather than one hub-and-spoke account
  // connected to everyone — this is what makes each account's Home feed
  // genuinely different, not a copy of everyone else's posts.
  await friend(ids.anmol, ids.priya, 20);
  await friend(ids.anmol, ids.sana, 18);
  await friend(ids.rohan, ids.karan, 15);
  await friend(ids.rohan, ids.vikram, 12);
  await friend(ids.rohan, ids.sana, 10);
  await friend(ids.priya, ids.neha, 9);
  await friend(ids.neha, ids.aisha, 7);

  console.log("Creating pending friend requests...");
  // These land in Anmol's "Incoming" tab — accept them (as Anmol, or log in
  // as Karan/Arjun and confirm the acceptance appears back on Anmol's side)
  // to see the real cross-account sync in action.
  await pendingRequest(ids.karan, ids.anmol, 2);
  await pendingRequest(ids.arjun, ids.anmol, 1);
  // Anmol has one outgoing request waiting on Neha's side, to exercise
  // "cancel" and to let Neha's account demonstrate accepting one too.
  await pendingRequest(ids.anmol, ids.neha, 3);
  await pendingRequest(ids.vikram, ids.sana, 2);

  console.log("Creating likes and comments...");
  const anmolPost1 = (await first("SELECT id FROM posts WHERE user_id = $1 ORDER BY id ASC LIMIT 1", [ids.anmol])).id;
  const rohanGolden = (await first("SELECT id FROM posts WHERE user_id = $1 ORDER BY id ASC LIMIT 1", [ids.rohan])).id;
  const sanaRun = (await first("SELECT id FROM posts WHERE user_id = $1 ORDER BY id ASC LIMIT 1 OFFSET 1", [ids.sana])).id;
  const nehaVideo = (await first("SELECT id FROM posts WHERE user_id = $1 ORDER BY id ASC LIMIT 1 OFFSET 1", [ids.neha])).id;

  await like(anmolPost1, ids.priya);
  await like(anmolPost1, ids.rohan);
  await like(anmolPost1, ids.sana);
  await comment(anmolPost1, ids.priya, "This looks so clean! The empty state illustration is a nice touch.");
  await comment(anmolPost1, ids.rohan, "Congrats — three weeks well spent 🎉");

  await like(rohanGolden, ids.anmol);
  await like(rohanGolden, ids.karan);
  await comment(rohanGolden, ids.anmol, "This is stunning. What lens were you using?");

  await like(sanaRun, ids.rohan);
  await like(sanaRun, ids.vikram);
  await comment(sanaRun, ids.rohan, "10k before breakfast, absolute legend.");

  await like(nehaVideo, ids.priya);
  await like(nehaVideo, ids.aisha);
  await comment(nehaVideo, ids.priya, "The frame-by-frame walk cycle is so smooth, incredible work.");

  console.log("\nSeed complete.");
  console.log("Demo accounts (all use password: Passw0rd!):");
  for (const id of Object.values(ids)) {
    const u = await first("SELECT username, email FROM users WHERE id = $1", [id]);
    console.log(`  - ${u.username}  (${u.email})`);
  }
  console.log("\nTip: log in as karan.mehta or arjun.malhotra, note the pending");
  console.log("request each has waiting on anmol.sharma; then log in as anmol.sharma");
  console.log("and accept it from the Friends page or right sidebar to see the");
  console.log("friendship reflect on both accounts.");
}

/** Wipe every table and load the demo data, all inside one transaction. */
export async function seedDatabase() {
  await transaction(async (client) => {
    c = client;
    try {
      await run();
    } finally {
      c = undefined;
    }
  });
}
