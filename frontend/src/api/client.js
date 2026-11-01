// Thin fetch wrapper for the Connectly API. Every call sends the httpOnly
// session cookie (credentials: "include") so the backend can identify the
// logged-in user without any token bookkeeping on our side.
//
// 3 tier setup: the browser calls "/api/..." on the SAME address the page was
// loaded from (the web tier). The web tier (Vite locally, Nginx on AWS)
// forwards those requests to the Node.js API on the application tier.
// Only set VITE_API_URL if you deliberately host the API on another domain.
const BASE_URL = import.meta.env.VITE_API_URL || "";

async function request(path, { method = "GET", body, isFormData = false } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: isFormData ? undefined : { "Content-Type": "application/json" },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const error = new Error(data?.error || data?.errors?.[0] || `Request failed (${res.status})`);
    error.status = res.status;
    error.errors = data?.errors;
    error.data = data;
    throw error;
  }
  return data;
}

export function mediaUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path}`;
}

// ---- Auth --------------------------------------------------------------
export const authApi = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  verifyTwoFactor: (payload) => request("/api/auth/login/2fa", { method: "POST", body: payload }),
  demoAccounts: () => request("/api/auth/demo-accounts"),
  changePassword: (payload) => request("/api/auth/password", { method: "PUT", body: payload }),
  sessions: () => request("/api/auth/sessions"),
  endSession: (id) => request(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  logoutOthers: () => request("/api/auth/sessions/logout-others", { method: "POST" }),
  setupTwoFactor: () => request("/api/auth/2fa/setup", { method: "POST" }),
  enableTwoFactor: (code) => request("/api/auth/2fa/enable", { method: "POST", body: { code } }),
  disableTwoFactor: (password) => request("/api/auth/2fa/disable", { method: "POST", body: { password } }),
};

// ---- Users ---------------------------------------------------------------
export const usersApi = {
  search: (q) => request(`/api/users/search?q=${encodeURIComponent(q)}`),
  suggestions: () => request("/api/users/suggestions"),
  getProfile: (username) => request(`/api/users/${encodeURIComponent(username)}`),
  updateProfile: (payload) => request("/api/users/me", { method: "PUT", body: payload }),
  updatePrivacy: (payload) => request("/api/users/me/privacy", { method: "PUT", body: payload }),
  updateNotificationSettings: (payload) => request("/api/users/me/notifications", { method: "PUT", body: payload }),
  birthdays: () => request("/api/users/birthdays"),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append("avatar", file);
    return request("/api/users/me/avatar", { method: "POST", body: fd, isFormData: true });
  },
  uploadCover: (file) => {
    const fd = new FormData();
    fd.append("cover", file);
    return request("/api/users/me/cover", { method: "POST", body: fd, isFormData: true });
  },
};

// ---- Posts -----------------------------------------------------------------
export const postsApi = {
  feed: () => request("/api/posts/feed"),
  explore: () => request("/api/posts/explore"),
  byUser: (userId) => request(`/api/posts/user/${userId}`),
  bookmarks: () => request("/api/posts/bookmarks"),
  get: (postId) => request(`/api/posts/${postId}`),
  trending: () => request("/api/posts/trending"),
  byHashtag: (tag) => request(`/api/posts/hashtag/${encodeURIComponent(tag)}`),
  create: ({ text, privacy, files = [], feeling = "", location = "" }) => {
    const fd = new FormData();
    fd.append("text", text);
    fd.append("privacy", privacy);
    if (feeling) fd.append("feeling", feeling);
    if (location) fd.append("location", location);
    files.forEach((f) => fd.append("media", f));
    return request("/api/posts", { method: "POST", body: fd, isFormData: true });
  },
  remove: (postId) => request(`/api/posts/${postId}`, { method: "DELETE" }),
  toggleLike: (postId) => request(`/api/posts/${postId}/like`, { method: "POST" }),
  toggleBookmark: (postId) => request(`/api/posts/${postId}/bookmark`, { method: "POST" }),
  getComments: (postId) => request(`/api/posts/${postId}/comments`),
  addComment: (postId, text, parentId) =>
    request(`/api/posts/${postId}/comments`, { method: "POST", body: { text, parentId } }),
  deleteComment: (commentId) => request(`/api/comments/${commentId}`, { method: "DELETE" }),
  toggleCommentLike: (commentId) => request(`/api/comments/${commentId}/like`, { method: "POST" }),
};

// ---- Friends -------------------------------------------------------------------
export const friendsApi = {
  status: (userId) => request(`/api/friends/status/${userId}`),
  incoming: () => request("/api/friends/incoming"),
  sent: () => request("/api/friends/sent"),
  list: () => request("/api/friends/list"),
  listOf: (userId) => request(`/api/friends/of/${userId}`),
  send: (userId) => request(`/api/friends/request/${userId}`, { method: "POST" }),
  cancel: (userId) => request(`/api/friends/cancel/${userId}`, { method: "POST" }),
  accept: (userId) => request(`/api/friends/accept/${userId}`, { method: "POST" }),
  reject: (userId) => request(`/api/friends/reject/${userId}`, { method: "POST" }),
  remove: (userId) => request(`/api/friends/remove/${userId}`, { method: "POST" }),
};

// ---- Messages -------------------------------------------------------------------
export const messagesApi = {
  conversations: () => request("/api/messages/conversations"),
  thread: (userId) => request(`/api/messages/${userId}`),
  send: (userId, text) => request(`/api/messages/${userId}`, { method: "POST", body: { text } }),
  markRead: (userId) => request(`/api/messages/${userId}/read`, { method: "POST" }),
  toggleLike: (messageId) => request(`/api/messages/like/${messageId}`, { method: "POST" }),
};

// ---- Notifications ---------------------------------------------------------------
export const notificationsApi = {
  list: () => request("/api/notifications"),
  markRead: (id) => request(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request("/api/notifications/read-all", { method: "POST" }),
};

// ---- Stories -----------------------------------------------------------------------
export const storiesApi = {
  list: () => request("/api/stories"),
  create: ({ file, text = "", background = "ocean" }) => {
    const fd = new FormData();
    if (file) fd.append("media", file);
    fd.append("text", text);
    fd.append("background", background);
    return request("/api/stories", { method: "POST", body: fd, isFormData: true });
  },
  view: (storyId) => request(`/api/stories/${storyId}/view`, { method: "POST" }),
  viewers: (storyId) => request(`/api/stories/${storyId}/viewers`),
  remove: (storyId) => request(`/api/stories/${storyId}`, { method: "DELETE" }),
};
