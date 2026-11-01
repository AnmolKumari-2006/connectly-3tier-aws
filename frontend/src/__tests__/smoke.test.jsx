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

const MOCK_USER = {
  id: 1,
  fullName: "Anmol Sharma",
  username: "anmol.sharma",
  email: "anmol@example.com",
  avatar: "",
  cover: "",
  bio: "Building Connectly",
  location: "Bengaluru, India",
  accountVisibility: "public",
  createdAt: "2026-01-01",
  stats: { posts: 1, friends: 2 },
};

const MOCK_POST = {
  id: 1,
  authorId: 1,
  author: { id: 1, fullName: "Anmol Sharma", username: "anmol.sharma", avatar: "" },
  text: "Shipped the new onboarding flow today.",
  privacy: "public",
  images: [],
  video: null,
  createdAt: "2026-01-01T00:00:00",
  likeCount: 3,
  commentCount: 1,
  likedByMe: false,
  bookmarkedByMe: false,
  likedAvatars: [],
};

// Maps a request path to a canned JSON response. Any endpoint not listed
// here falls back to an empty-but-valid shape so unrelated fetches (e.g.
// trending/suggestions on pages we're not testing) don't blow up the test.
function installFetchMock(overrides = {}) {
  const defaultResponses = {
    "/api/auth/me": { ok: true, body: { user: MOCK_USER } },
    "/api/posts/feed": { ok: true, body: { posts: [MOCK_POST] } },
    "/api/notifications": { ok: true, body: { notifications: [] } },
    "/api/friends/incoming": { ok: true, body: { incoming: [] } },
    "/api/friends/sent": { ok: true, body: { sent: [] } },
    "/api/friends/list": { ok: true, body: { friends: [] } },
    "/api/users/suggestions": { ok: true, body: { suggestions: [] } },
    ...overrides,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn((url) => {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const match = Object.keys(defaultResponses).find((key) => path.startsWith(key));
      const response = match ? defaultResponses[match] : { ok: true, body: {} };

      return Promise.resolve({
        ok: response.ok,
        status: response.ok ? 200 : response.status || 400,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve(response.body),
      });
    })
  );
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

describe("Auth gating", () => {
  it("redirects to /login when the session check fails", async () => {
    installFetchMock({ "/api/auth/me": { ok: false, status: 401, body: { error: "Not authenticated." } } });
    renderAt("/");
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  });

  it("renders the authenticated app shell when the session check succeeds", async () => {
    installFetchMock();
    renderAt("/");
    expect(await screen.findByRole("heading", { name: /Anmol/i })).toBeInTheDocument();
    expect(await screen.findByText(/onboarding flow/i)).toBeInTheDocument();
  });
});

describe("Every protected route renders without throwing (authenticated)", () => {
  const ROUTES = ["/", "/explore", "/friends", "/notifications", "/settings", "/messages", "/bookmarks"];
  for (const path of ROUTES) {
    it(`renders ${path}`, async () => {
      installFetchMock();
      expect(() => renderAt(path)).not.toThrow();
      // Let the initial data-fetch effects settle before the test ends.
      await waitFor(() => expect(fetch).toHaveBeenCalled());
    });
  }
});

describe("Login page", () => {
  it("submits credentials to the real login endpoint", async () => {
    installFetchMock({ "/api/auth/me": { ok: false, status: 401, body: {} } });
    renderAt("/login");

    fireEvent.change(await screen.findByPlaceholderText(/you@example.com/i), {
      target: { value: "anmol.sharma" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "Passw0rd!" } });

    installFetchMock({ "/api/auth/login": { ok: true, body: { user: MOCK_USER } } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      const loginCalls = fetch.mock.calls.filter(([url]) => url.includes("/api/auth/login"));
      expect(loginCalls.length).toBeGreaterThan(0);
    });
  });
});

describe("Home feed interaction", () => {
  it("optimistically toggles like via the real API call shape", async () => {
    installFetchMock({
      "/api/posts/1/like": { ok: true, body: { liked: true, likeCount: 4 } },
    });
    renderAt("/");
    const likeButton = await screen.findByRole("button", { name: /^Like$/i });
    fireEvent.click(likeButton);
    expect(await screen.findByRole("button", { name: /^Liked$/i })).toBeInTheDocument();
    expect(await screen.findByText(/4 likes/i)).toBeInTheDocument();
  });
});

describe("Regression: liking a post on Explore (not just Home)", () => {
  // This is the exact bug that was reported: Explore and Profile pages
  // keep their own local post lists, separate from the Home feed in
  // SocialDataContext. Liking a post used to call an action that only
  // patched the Home feed's array, so the heart never visibly filled in
  // anywhere except Home. PostCard now owns this state itself so it works
  // regardless of which page's list it was rendered from.
  it("updates the like state on a post rendered from Explore's own list", async () => {
    installFetchMock({
      "/api/posts/explore": { ok: true, body: { posts: [MOCK_POST] } },
      "/api/posts/1/like": { ok: true, body: { liked: true, likeCount: 4 } },
    });
    renderAt("/explore");
    const likeButton = await screen.findByRole("button", { name: /^Like$/i });
    fireEvent.click(likeButton);
    expect(await screen.findByRole("button", { name: /^Liked$/i })).toBeInTheDocument();
    expect(await screen.findByText(/4 likes/i)).toBeInTheDocument();
  });
});

describe("Messaging", () => {
  const FRIEND = { id: 2, fullName: "Priya Nair", username: "priya.nair", avatar: "" };

  it("opens a conversation and sends a message", async () => {
    installFetchMock({
      "/api/messages/conversations": {
        ok: true,
        body: { conversations: [{ user: FRIEND, lastMessage: null, unreadCount: 0 }] },
      },
      "/api/messages/2": { ok: true, body: { user: FRIEND, messages: [] } },
      "/api/messages/2/read": { ok: true, body: { success: true } },
    });
    renderAt("/messages");

    const conversationButton = await screen.findByRole("button", { name: /Priya Nair/i });
    fireEvent.click(conversationButton);

    await screen.findByText(/say hello to Priya/i);

    installFetchMock({
      "/api/messages/conversations": {
        ok: true,
        body: { conversations: [{ user: FRIEND, lastMessage: null, unreadCount: 0 }] },
      },
      "/api/messages/2": { ok: true, body: { user: FRIEND, messages: [] } },
      "/api/messages/2/read": { ok: true, body: { success: true } },
      "/api/messages/2/send": {},
    });
    // The POST to /api/messages/2 (send) needs its own distinct mock since
    // it shares a path prefix with the GET thread endpoint above.
    vi.stubGlobal(
      "fetch",
      vi.fn((url, options) => {
        const path = url.replace(/^https?:\/\/[^/]+/, "");
        if (path === "/api/messages/2" && options?.method === "POST") {
          return Promise.resolve({
            ok: true,
            status: 201,
            headers: { get: () => "application/json" },
            json: () =>
              Promise.resolve({
                message: { id: 99, senderId: 1, receiverId: 2, text: "Hey Priya!", isRead: false, createdAt: "2026-01-01T00:00:00" },
              }),
          });
        }
        const defaults = {
          "/api/auth/me": { user: MOCK_USER },
          "/api/messages/conversations": { conversations: [{ user: FRIEND, lastMessage: null, unreadCount: 0 }] },
          "/api/messages/2": { user: FRIEND, messages: [] },
        };
        const match = Object.keys(defaults).find((k) => path.startsWith(k));
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve(match ? defaults[match] : {}),
        });
      })
    );

    const input = screen.getByPlaceholderText(/Message Priya/i);
    fireEvent.change(input, { target: { value: "Hey Priya!" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("Hey Priya!")).toBeInTheDocument();
  });
});

describe("Regression: accepting a friend request updates every place it's shown", () => {
  // The reported bug: the right sidebar and the Friends page each fetched
  // their own separate copy of "incoming requests". Accepting one on the
  // Friends page left a stale, already-resolved card sitting in the
  // sidebar (which never unmounts) until a full page reload. Incoming
  // requests now live in SocialDataContext, shared by both.
  const REQUEST = {
    requestId: 9,
    mutual: 2,
    user: { id: 2, fullName: "Karan Mehta", username: "karan.mehta", avatar: "" },
  };

  it("removes the request from the Friends page after accepting, and from the sidebar too", async () => {
    installFetchMock({
      "/api/friends/incoming": { ok: true, body: { incoming: [REQUEST] } },
      "/api/friends/sent": { ok: true, body: { sent: [] } },
      "/api/friends/list": { ok: true, body: { friends: [] } },
      "/api/friends/accept/2": { ok: true, body: { status: "friends" } },
    });
    renderAt("/friends");

    // Confirmed present in both the Friends page content AND the right
    // sidebar (both share the same context state) before accepting.
    expect(await screen.findAllByText(/Karan Mehta/i)).toHaveLength(2);

    const main = within(document.querySelector("main"));
    const acceptButton = await main.findByRole("button", { name: /Accept Karan Mehta/i });
    fireEvent.click(acceptButton);

    // After accepting, it should disappear everywhere at once — no stale
    // card left behind in the sidebar.
    await waitFor(() => expect(screen.queryAllByText(/Karan Mehta/i)).toHaveLength(0));
  });
});
