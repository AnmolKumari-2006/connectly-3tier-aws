/**
 * End-to-end API test for the Connectly backend.
 *
 * Talks to a RUNNING API over HTTP (so it exercises Express + PostgreSQL
 * together, exactly as the frontend does). It registers fresh throwaway
 * accounts, so run it against a local/dev database, not production.
 *
 *   npm start                 # terminal 1
 *   npm test                  # terminal 2   (API_URL defaults to http://localhost:4000)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const API = process.env.API_URL || "http://localhost:4000";
const run = Date.now().toString(36);

// Tiny cookie-aware client: one instance per logged-in user.
function client() {
  let cookie = "";
  return async function call(method, path, body, { form } = {}) {
    const res = await fetch(API + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body && !form ? { "content-type": "application/json" } : {}),
      },
      body: form ? body : body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
    return { status: res.status, data };
  };
}

async function register(call, name) {
  const username = `t_${name}_${run}`;
  const r = await call("POST", "/api/auth/register", {
    fullName: `Test ${name}`,
    username,
    email: `${username}@example.com`,
    password: "Passw0rd!",
    confirmPassword: "Passw0rd!",
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.user;
}

// 1x1 transparent PNG, used for upload tests.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const pngForm = (field, extra = {}) => {
  const fd = new FormData();
  fd.append(field, new Blob([PNG], { type: "image/png" }), "pixel.png");
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
};

const A = client();
const B = client();
const C = client();
let a, b, c;

test("health check reaches the database", async () => {
  const r = await fetch(`${API}/api/health`).then((x) => x.json());
  assert.equal(r.status, "ok");
  assert.equal(r.database, "connected");
});

test("register, login (with @username), me, logout", async () => {
  a = await register(A, "alice");
  b = await register(B, "bob");
  c = await register(C, "carol");

  const dup = await A("POST", "/api/auth/register", {
    fullName: "X", username: a.username, email: "other@example.com", password: "Passw0rd!",
  });
  assert.equal(dup.status, 400);

  const anon = client();
  assert.equal((await anon("GET", "/api/auth/me")).status, 401);
  assert.equal((await anon("POST", "/api/auth/login", { identifier: a.username, password: "wrong" })).status, 401);
  const login = await anon("POST", "/api/auth/login", { identifier: `@${a.username}`, password: "Passw0rd!" });
  assert.equal(login.status, 200);
  assert.equal((await anon("GET", "/api/auth/me")).data.user.id, a.id);
});

test("friend request: send, see incoming, accept", async () => {
  assert.equal((await A("POST", `/api/friends/request/${b.id}`)).data.status, "request_sent");
  assert.equal((await A("POST", `/api/friends/request/${b.id}`)).status, 400); // duplicate

  const incoming = (await B("GET", "/api/friends/incoming")).data.incoming;
  assert.ok(incoming.some((r) => r.user.id === a.id));
  assert.equal((await A("GET", "/api/friends/sent")).data.sent[0].user.id, b.id);

  assert.equal((await B("POST", `/api/friends/accept/${a.id}`)).data.status, "friends");
  assert.ok((await A("GET", "/api/friends/list")).data.friends.some((f) => f.id === b.id));
  assert.equal((await B("GET", `/api/friends/status/${a.id}`)).data.status, "friends");

  const notifs = (await A("GET", "/api/notifications")).data.notifications;
  assert.ok(notifs.some((n) => n.type === "friend_accept" && n.actor.id === b.id));
});

test("reject, then a new request is allowed again", async () => {
  await C("POST", `/api/friends/request/${a.id}`);
  assert.equal((await A("POST", `/api/friends/reject/${c.id}`)).data.status, "none");
  assert.equal((await C("POST", `/api/friends/request/${a.id}`)).data.status, "request_sent");
  assert.equal((await C("POST", `/api/friends/cancel/${a.id}`)).data.status, "none");
});

let postId;
test("posts: create with image, privacy, feed, likes, bookmarks", async () => {
  const created = await A("POST", "/api/posts", pngForm("media", { text: "Hello from PostgreSQL", privacy: "friends" }), { form: true });
  assert.equal(created.status, 201);
  postId = created.data.post.id;
  assert.equal(created.data.post.images.length, 1);

  assert.ok((await B("GET", "/api/posts/feed")).data.posts.some((p) => p.id === postId)); // friend sees it
  assert.ok(!(await C("GET", `/api/posts/user/${a.id}`)).data.posts.some((p) => p.id === postId)); // stranger doesn't
  assert.equal((await C("POST", `/api/posts/${postId}/like`)).status, 403);

  const liked = await B("POST", `/api/posts/${postId}/like`);
  assert.deepEqual(liked.data, { liked: true, likeCount: 1 });
  assert.deepEqual((await B("POST", `/api/posts/${postId}/like`)).data, { liked: false, likeCount: 0 });
  await B("POST", `/api/posts/${postId}/like`);

  assert.equal((await B("POST", `/api/posts/${postId}/bookmark`)).data.bookmarked, true);
  assert.equal((await B("GET", "/api/posts/bookmarks")).data.posts[0].id, postId);

  const empty = await A("POST", "/api/posts", { text: "  " });
  assert.equal(empty.status, 400);
});

test("comments: add, reply, like, delete", async () => {
  const c1 = await B("POST", `/api/posts/${postId}/comments`, { text: "Nice post!" });
  assert.equal(c1.status, 201);
  assert.equal(c1.data.commentCount, 1);

  const reply = await A("POST", `/api/posts/${postId}/comments`, { text: "Thanks!", parentId: c1.data.comment.id });
  assert.equal(reply.data.comment.parentId, c1.data.comment.id);

  assert.deepEqual((await A("POST", `/api/comments/${c1.data.comment.id}/like`)).data, { liked: true, likeCount: 1 });
  const list = (await A("GET", `/api/posts/${postId}/comments`)).data.comments;
  assert.equal(list.length, 2);
  assert.equal(list[0].likeCount, 1);

  assert.equal((await C("DELETE", `/api/comments/${reply.data.comment.id}`)).status, 403);
  assert.equal((await A("DELETE", `/api/comments/${reply.data.comment.id}`)).data.commentCount, 1);
});

test("messages: send, conversation list, unread, read, like", async () => {
  assert.equal((await C("POST", `/api/messages/${a.id}`, { text: "hi" })).status, 403); // not friends

  const sent = await A("POST", `/api/messages/${b.id}`, { text: "Hello Bob" });
  assert.equal(sent.status, 201);
  await A("POST", `/api/messages/${b.id}`, { text: "Second message" });

  const convo = (await B("GET", "/api/messages/conversations")).data.conversations.find((x) => x.user.id === a.id);
  assert.equal(convo.unreadCount, 2);
  assert.equal(convo.lastMessage.text, "Second message");

  const thread = (await B("GET", `/api/messages/${a.id}`)).data.messages;
  assert.deepEqual(thread.map((m) => m.text), ["Hello Bob", "Second message"]);

  await B("POST", `/api/messages/${a.id}/read`);
  const after = (await B("GET", "/api/messages/conversations")).data.conversations.find((x) => x.user.id === a.id);
  assert.equal(after.unreadCount, 0);

  assert.deepEqual((await B("POST", `/api/messages/like/${sent.data.message.id}`)).data, { liked: true, likeCount: 1 });
});

test("stories: text + photo, friend views, viewer list, delete", async () => {
  const textForm = new FormData();
  textForm.append("text", "My story");
  textForm.append("background", "sunset");
  const text = await A("POST", "/api/stories", textForm, { form: true });
  assert.equal(text.status, 201);
  assert.equal(text.data.story.background, "sunset");
  const photo = await A("POST", "/api/stories", pngForm("media", { text: "caption" }), { form: true });
  assert.equal(photo.data.story.mediaType, "image");
  assert.equal((await A("POST", "/api/stories", { text: "" })).status, 400);

  const group = (await B("GET", "/api/stories")).data.groups.find((g) => g.user.id === a.id);
  assert.equal(group.stories.length, 2);
  assert.equal(group.allViewed, false);
  assert.ok(!(await C("GET", "/api/stories")).data.groups.some((g) => g.user.id === a.id)); // stranger

  await B("POST", `/api/stories/${text.data.story.id}/view`);
  assert.equal((await A("GET", `/api/stories/${text.data.story.id}/viewers`)).data.viewers[0].id, b.id);
  assert.equal((await B("GET", `/api/stories/${text.data.story.id}/viewers`)).status, 403);

  const mine = (await A("GET", "/api/stories")).data.groups[0];
  assert.equal(mine.isMine, true);
  assert.equal(mine.stories[0].viewCount, 1);

  assert.equal((await B("DELETE", `/api/stories/${photo.data.story.id}`)).status, 403);
  assert.equal((await A("DELETE", `/api/stories/${photo.data.story.id}`)).data.success, true);
});

test("profile, avatar upload, privacy, search, suggestions", async () => {
  const upd = await A("PUT", "/api/users/me", { bio: "Testing bio", location: "Karachi" });
  assert.equal(upd.data.user.bio, "Testing bio");

  const avatar = await A("POST", "/api/users/me/avatar", pngForm("avatar"), { form: true });
  assert.match(avatar.data.user.avatar, /^\/uploads\/avatars\//);

  await A("PUT", "/api/users/me/privacy", { accountVisibility: "private" });
  assert.equal((await C("GET", `/api/friends/of/${a.id}`)).status, 403);
  assert.equal((await C("GET", `/api/users/${a.username}`)).data.isPrivateStranger, true);
  await A("PUT", "/api/users/me/privacy", { accountVisibility: "public" });

  const search = (await C("GET", `/api/users/search?q=${encodeURIComponent("TEST ALICE")}`)).data.results;
  assert.ok(search.some((u) => u.id === a.id), "search is case-insensitive");
  assert.ok(Array.isArray((await C("GET", "/api/users/suggestions")).data.suggestions));
});

test("notifications: list, mark one, mark all", async () => {
  const list = (await A("GET", "/api/notifications")).data.notifications;
  assert.ok(list.length > 0);
  assert.equal((await A("POST", `/api/notifications/${list[0].id}/read`)).data.success, true);
  await A("POST", "/api/notifications/read-all");
  assert.ok((await A("GET", "/api/notifications")).data.notifications.every((n) => n.isRead));
});

test("bad input is rejected cleanly", async () => {
  assert.equal((await A("GET", "/api/posts/abc/comments")).status, 400);
  assert.equal((await A("GET", "/api/posts/999999/comments")).status, 404);
  assert.equal((await A("GET", "/api/does-not-exist")).status, 404);
  assert.equal((await B("DELETE", `/api/posts/${postId}`)).status, 403);
});

test("remove friend and delete post", async () => {
  assert.equal((await A("POST", `/api/friends/remove/${b.id}`)).data.status, "none");
  assert.equal((await A("DELETE", `/api/posts/${postId}`)).data.success, true);
  assert.equal((await B("GET", `/api/posts/${postId}/comments`)).status, 404);
});
