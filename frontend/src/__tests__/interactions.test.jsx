import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { ThemeProvider } from "../context/ThemeContext";
import { ToastProvider } from "../context/ToastContext";
import { AuthProvider } from "../context/AuthContext";
import { SocialDataProvider } from "../context/SocialDataContext";
import { CreatePostModalProvider } from "../context/CreatePostModalContext";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ME = { id: 1, fullName: "Anmol Sharma", username: "anmol.sharma", email: "a@x.com", avatar: "", cover: "", bio: "", location: "", accountVisibility: "public", createdAt: "2026-01-01 00:00:00", stats: { posts: 0, friends: 1 } };
const FRIEND = { id: 2, fullName: "Priya Nair", username: "priya.nair", avatar: "" };
const POST = { id: 1, authorId: 1, author: { id: 1, fullName: "Anmol Sharma", username: "anmol.sharma", avatar: "" }, text: "Hello world", privacy: "public", images: [], video: null, createdAt: "2026-01-01 00:00:00", likeCount: 0, commentCount: 1, likedByMe: false, bookmarkedByMe: false, likedAvatars: [] };

/**
 * Method-aware fetch mock. Each route is [METHOD, path, body]; the first
 * route whose method matches and whose path equals (or is a prefix of) the
 * requested path wins, so put more specific routes first.
 */
function mockApi(routes) {
  const calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url, options = {}) => {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const method = (options.method || "GET").toUpperCase();
      calls.push({ method, path });
      const hit = routes.find(([m, p]) => m === method && (path === p || path.startsWith(p + "?")));
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve(hit ? hit[2] : {}),
      });
    })
  );
  return calls;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SocialDataProvider>
              <CreatePostModalProvider>
                <App />
              </CreatePostModalProvider>
            </SocialDataProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const baseRoutes = [
  ["GET", "/api/auth/me", { user: ME }],
  ["GET", "/api/notifications", { notifications: [] }],
  ["GET", "/api/friends/incoming", { incoming: [] }],
];

// The <main> content area only exists once the session check has resolved,
// so every query waits for it first.
const inMain = (method) => async (...args) => {
  await waitFor(() => expect(document.querySelector("main")).not.toBeNull());
  return within(document.querySelector("main"))[method](...args);
};
const main = () => ({
  findByRole: inMain("findByRole"),
  findByText: inMain("findByText"),
  findByLabelText: inMain("findByLabelText"),
});

describe("Liking a comment", () => {
  it("toggles the like and shows the count", async () => {
    const calls = mockApi([
      ...baseRoutes,
      ["GET", "/api/posts/feed", { posts: [POST] }],
      ["GET", "/api/posts/1/comments", {
        comments: [{ id: 7, postId: 1, parentId: null, text: "nice architecture", createdAt: "2026-01-01 00:00:00", likeCount: 0, likedByMe: false, author: FRIEND }],
      }],
      ["POST", "/api/comments/7/like", { liked: true, likeCount: 1 }],
    ]);
    renderAt("/");

    fireEvent.click(await main().findByRole("button", { name: /^Comment$/i }));
    fireEvent.click(await main().findByRole("button", { name: /like comment/i }));

    expect(await main().findByRole("button", { name: /unlike comment/i })).toHaveAttribute("aria-pressed", "true");
    expect(await main().findByLabelText("1 likes")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/comments/7/like")).toBe(true);
  });
});

describe("Chat: emoji and message likes", () => {
  const thread = (extra = {}) => ({
    user: FRIEND,
    messages: [{ id: 5, senderId: 2, receiverId: 1, text: "see you soon", isRead: true, createdAt: "2026-01-01 00:00:00", likeCount: 0, likedByMe: false, ...extra }],
  });
  const chatRoutes = [
    ...baseRoutes,
    ["GET", "/api/messages/conversations", { conversations: [{ user: FRIEND, lastMessage: null, unreadCount: 0 }] }],
    ["GET", "/api/messages/2", thread()],
    ["POST", "/api/messages/2/read", { success: true }],
  ];

  async function openChat() {
    fireEvent.click(await main().findByRole("button", { name: /Priya Nair/i }));
    await main().findByText("see you soon");
  }

  it("inserts a picked emoji into the message box", async () => {
    mockApi(chatRoutes);
    renderAt("/messages");
    await openChat();

    const input = screen.getByPlaceholderText(/Message Priya/i);
    fireEvent.change(input, { target: { value: "hi " } });
    fireEvent.click(screen.getByRole("button", { name: /add emoji/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Insert 😀" }));

    await waitFor(() => expect(input.value).toContain("😀"));
    expect(input.value.startsWith("hi")).toBe(true);
  });

  it("likes a chat message and shows the heart count", async () => {
    const calls = mockApi([
      ["POST", "/api/messages/like/5", { liked: true, likeCount: 1 }],
      ...chatRoutes,
    ]);
    renderAt("/messages");
    await openChat();

    fireEvent.click(screen.getByRole("button", { name: /like message/i }));

    expect(await screen.findByRole("button", { name: /unlike message/i })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByLabelText("1 likes")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/messages/like/5")).toBe(true);
  });

  it("shows the real clock time on a message, not a relative '5h'", async () => {
    mockApi(chatRoutes);
    renderAt("/messages");
    await openChat();
    const stamp = document.querySelector("time[datetime='2026-01-01 00:00:00']");
    expect(stamp).not.toBeNull();
    expect(stamp.textContent).toMatch(/\d{1,2}:\d{2}/);
    expect(stamp.textContent).not.toMatch(/\d+h$/);
  });
});
