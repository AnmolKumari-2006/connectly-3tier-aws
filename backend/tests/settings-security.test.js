/**
 * End-to-end tests for settings, security (sessions, password, 2FA) and the
 * data-driven features (trending hashtags, birthdays, post links).
 * Like api-smoke.test.js these talk to a RUNNING API: run `npm start` first.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { codeAt, currentStep } from "../utils/totp.js";

const API = process.env.API_URL || "http://localhost:4000";
const run = Date.now().toString(36);

function client(userAgent = "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0") {
  let cookie = "";
  return async function call(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: {
        "user-agent": userAgent,
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
    return { status: res.status, data };
  };
}

async function register(call, name) {
  const username = `s_${name}_${run}`;
  const r = await call("POST", "/api/auth/register", {
    fullName: `Settings ${name}`,
    username,
    email: `${username}@example.com`,
    password: "Passw0rd!",
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.user;
}

const A = client();
const B = client();
let a, b;

test("setup: two friends", async () => {
  a = await register(A, "amy");
  b = await register(B, "ben");
  await A("POST", `/api/friends/request/${b.id}`);
  assert.equal((await B("POST", `/api/friends/accept/${a.id}`)).data.status, "friends");
  assert.deepEqual(a.settings.notifications, { likes: true, comments: true, friendRequests: true, messages: true });
  assert.equal(a.settings.defaultPostPrivacy, "friends");
});

test("sessions: list devices, sign out another device", async () => {
  const phone = client("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile");
  assert.equal((await phone("POST", "/api/auth/login", { identifier: a.username, password: "Passw0rd!" })).status, 200);

  const list = (await A("GET", "/api/auth/sessions")).data.sessions;
  assert.equal(list.length, 2);
  assert.ok(list.some((s) => s.current && s.device === "Chrome on Windows"));
  assert.ok(list.some((s) => !s.current && s.device === "Chrome on Android"));

  const r = await A("POST", "/api/auth/sessions/logout-others");
  assert.equal(r.data.signedOutSessions, 1);
  assert.equal((await phone("GET", "/api/auth/me")).status, 401, "signed out device is logged out immediately");
  assert.equal((await A("GET", "/api/auth/me")).status, 200, "this device stays logged in");
});

test("logout ends the session on the server", async () => {
  const tmp = client();
  await tmp("POST", "/api/auth/login", { identifier: a.username, password: "Passw0rd!" });
  assert.equal((await tmp("POST", "/api/auth/logout")).status, 200);
  assert.equal((await tmp("GET", "/api/auth/me")).status, 401);
});

test("change password: checks current, signs out other devices", async () => {
  const other = client();
  await other("POST", "/api/auth/login", { identifier: a.username, password: "Passw0rd!" });

  assert.equal((await A("PUT", "/api/auth/password", { currentPassword: "wrong", newPassword: "NewPass123" })).status, 400);
  assert.equal((await A("PUT", "/api/auth/password", { currentPassword: "Passw0rd!", newPassword: "short" })).status, 400);
  const ok = await A("PUT", "/api/auth/password", { currentPassword: "Passw0rd!", newPassword: "NewPass123" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.signedOutSessions, 1);
  assert.equal((await other("GET", "/api/auth/me")).status, 401);

  const fresh = client();
  assert.equal((await fresh("POST", "/api/auth/login", { identifier: a.username, password: "Passw0rd!" })).status, 401);
  assert.equal((await fresh("POST", "/api/auth/login", { identifier: a.username, password: "NewPass123" })).status, 200);
});

test("two factor: setup, enable, login needs code, disable", async () => {
  const setup = await A("POST", "/api/auth/2fa/setup");
  assert.match(setup.data.qrCode, /^data:image\/png;base64,/);
  assert.match(setup.data.otpauthUrl, /^otpauth:\/\/totp\//);
  const secret = setup.data.secret;

  assert.equal((await A("POST", "/api/auth/2fa/enable", { code: "000000" })).status, 400);
  assert.equal((await A("POST", "/api/auth/2fa/enable", { code: codeAt(secret, currentStep()) })).status, 200);
  assert.equal((await A("GET", "/api/auth/me")).data.user.settings.twoFactorEnabled, true);

  const phone = client();
  const step1 = await phone("POST", "/api/auth/login", { identifier: a.username, password: "NewPass123" });
  assert.equal(step1.data.twoFactorRequired, true);
  assert.equal((await phone("GET", "/api/auth/me")).status, 401, "password alone does not log in");
  assert.equal((await phone("POST", "/api/auth/login/2fa", { challenge: step1.data.challenge, code: "123456" })).status, 401);
  const step2 = await phone("POST", "/api/auth/login/2fa", { challenge: step1.data.challenge, code: codeAt(secret, currentStep()) });
  assert.equal(step2.status, 200);
  assert.equal((await phone("GET", "/api/auth/me")).data.user.id, a.id);

  assert.equal((await A("POST", "/api/auth/2fa/disable", { password: "wrong" })).status, 400);
  assert.equal((await A("POST", "/api/auth/2fa/disable", { password: "NewPass123" })).status, 200);
  const again = await client()("POST", "/api/auth/login", { identifier: a.username, password: "NewPass123" });
  assert.equal(again.data.user.id, a.id, "no code needed after turning it off");
});

test("privacy settings are saved and enforced", async () => {
  const r = await A("PUT", "/api/users/me/privacy", { defaultPostPrivacy: "public", showActivity: false, showEmail: true });
  assert.equal(r.data.user.settings.defaultPostPrivacy, "public");
  assert.equal(r.data.user.settings.showActivity, false);
  assert.equal((await A("PUT", "/api/users/me/privacy", { defaultPostPrivacy: "everyone" })).status, 400);

  // Friend sees the email (showEmail on); a stranger does not.
  assert.equal((await B("GET", `/api/users/${a.username}`)).data.user.email, a.email);
  const stranger = client();
  await register(stranger, "sam");
  assert.equal((await stranger("GET", `/api/users/${a.username}`)).data.user.email, undefined);

  // Activity status hidden from friends.
  const convo = (await B("GET", "/api/messages/conversations")).data.conversations.find((c) => c.user.id === a.id);
  assert.equal(convo.user.presence, null);
  await A("PUT", "/api/users/me/privacy", { showActivity: true });
  const convo2 = (await B("GET", "/api/messages/conversations")).data.conversations.find((c) => c.user.id === a.id);
  assert.equal(convo2.user.presence.online, true);
});

test("notification settings stop those notifications", async () => {
  await A("PUT", "/api/users/me/notifications", { likes: false });
  const post = await A("POST", "/api/posts", { text: "Settings test #ConnectlyQA", privacy: "public" });
  await B("POST", `/api/posts/${post.data.post.id}/like`);
  const n1 = (await A("GET", "/api/notifications")).data.notifications;
  assert.ok(!n1.some((n) => n.type === "like" && n.postId === post.data.post.id), "like notification suppressed");

  await A("PUT", "/api/users/me/notifications", { likes: true, comments: true });
  await B("POST", `/api/posts/${post.data.post.id}/comments`, { text: "nice" });
  const n2 = (await A("GET", "/api/notifications")).data.notifications;
  assert.ok(n2.some((n) => n.type === "comment" && n.postId === post.data.post.id));
  assert.equal((await A("PUT", "/api/users/me/notifications", { likes: "yes" })).status, 400);
});

test("posts: feeling, location, single post link, hashtags", async () => {
  const created = await B("POST", "/api/posts", {
    text: `Testing #ConnectlyQA tags ${run}`,
    privacy: "public",
    feeling: "😊 happy",
    location: "Karachi, Pakistan",
  });
  assert.equal(created.data.post.feeling, "😊 happy");
  assert.equal(created.data.post.location, "Karachi, Pakistan");

  const id = created.data.post.id;
  assert.equal((await A("GET", `/api/posts/${id}`)).data.post.id, id);
  assert.equal((await A("GET", "/api/posts/99999999")).status, 404);

  const tagged = (await A("GET", "/api/posts/hashtag/connectlyqa")).data.posts.map((p) => p.id);
  assert.ok(tagged.includes(id), "hashtag search is case insensitive");
  const trending = (await A("GET", "/api/posts/trending")).data.hashtags;
  assert.ok(trending.some((t) => t.tag.toLowerCase() === "connectlyqa" && t.posts >= 2));
  assert.equal((await A("GET", "/api/posts/hashtag/bad tag!")).status, 400);

  const onlyMe = await B("POST", "/api/posts", { text: "secret #ConnectlyQA", privacy: "only_me" });
  assert.equal((await A("GET", `/api/posts/${onlyMe.data.post.id}`)).status, 404, "private post link is not viewable");
});

test("birthdays: friend's upcoming birthday appears", async () => {
  const soon = new Date(Date.now() + 5 * 86400000);
  const birthday = `${soon.getFullYear() - 22}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
  const r = await B("PUT", "/api/users/me", { birthday });
  assert.equal(r.data.user.birthday, birthday);
  assert.equal((await B("PUT", "/api/users/me", { birthday: "2999-01-01" })).status, 400);

  const list = (await A("GET", "/api/users/birthdays")).data.birthdays;
  const entry = list.find((x) => x.user.id === b.id);
  assert.ok(entry);
  assert.ok(entry.daysAway >= 4 && entry.daysAway <= 5);
  assert.equal(entry.turningAge, 22);
});

test("demo accounts come from the database", async () => {
  const r = await client()("GET", "/api/auth/demo-accounts");
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data.accounts));
  assert.ok(!r.data.accounts.some((acc) => acc.username === a.username), "registered users are never listed");
});
