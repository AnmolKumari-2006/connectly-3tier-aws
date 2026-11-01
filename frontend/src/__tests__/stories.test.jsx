import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  vi.unstubAllGlobals();
});

const ME = { id: 1, fullName: "Anmol Sharma", username: "anmol.sharma", email: "a@x.com", avatar: "", cover: "", bio: "", location: "", accountVisibility: "public", createdAt: "2026-01-01 00:00:00", stats: { posts: 0, friends: 1 } };
const now = new Date().toISOString();
const FRIEND_GROUP = {
  user: { id: 2, fullName: "Priya Nair", username: "priya.nair", avatar: "" },
  isMine: false,
  allViewed: false,
  latestAt: now,
  stories: [{ id: 11, userId: 2, mediaUrl: null, mediaType: null, text: "Coffee first, then pixels", background: "sunset", createdAt: now, expiresAt: now, viewedByMe: false }],
};

function mockApi(handler) {
  const calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url, options = {}) => {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const method = (options.method || "GET").toUpperCase();
      calls.push({ method, path, body: options.body });
      const shared = {
        "/api/notifications": { notifications: [] },
        "/api/friends/incoming": { incoming: [] },
        "/api/friends/sent": { sent: [] },
        "/api/friends/list": { friends: [] },
        "/api/users/suggestions": { suggestions: [] },
      };
      const body = handler(method, path, options) ?? shared[path] ?? {};
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve(body),
      });
    })
  );
  return calls;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
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

describe("Stories", () => {
  it("creates a text story and sends it to the API", async () => {
    let created = false;
    const calls = mockApi((method, path) => {
      if (path === "/api/auth/me") return { user: ME };
      if (path === "/api/posts/feed") return { posts: [] };
      if (method === "POST" && path === "/api/stories") {
        created = true;
        return { story: { id: 99 } };
      }
      if (path === "/api/stories") {
        return {
          groups: created
            ? [{ user: { id: 1, fullName: ME.fullName, username: ME.username, avatar: "" }, isMine: true, allViewed: true, latestAt: now, stories: [{ id: 99, userId: 1, text: "My first story", background: "grape", createdAt: now, viewedByMe: true, viewCount: 0 }] }]
            : [],
        };
      }
      return undefined;
    });

    renderHome();
    fireEvent.click(await screen.findByLabelText("Add story"));
    fireEvent.click(await screen.findByRole("button", { name: /^text$/i }));
    fireEvent.change(await screen.findByPlaceholderText("Start typing…"), { target: { value: "My first story" } });
    fireEvent.click(screen.getByLabelText("grape background"));
    fireEvent.click(screen.getByRole("button", { name: /share to story/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/stories")).toBe(true));
    const post = calls.find((c) => c.method === "POST" && c.path === "/api/stories");
    expect(post.body.get("text")).toBe("My first story");
    expect(post.body.get("background")).toBe("grape");
    expect(await screen.findByText("Your story")).toBeInTheDocument();
  });

  it("opens a friend's story and marks it as viewed", async () => {
    const calls = mockApi((method, path) => {
      if (path === "/api/auth/me") return { user: ME };
      if (path === "/api/posts/feed") return { posts: [] };
      if (path === "/api/stories") return { groups: [FRIEND_GROUP] };
      return undefined;
    });

    renderHome();
    fireEvent.click(await screen.findByLabelText("View Priya Nair's story"));
    expect(await screen.findByText("Coffee first, then pixels")).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/stories/11/view")).toBe(true));

    fireEvent.click(screen.getByLabelText("Close story"));
    await waitFor(() => expect(screen.queryByText("Coffee first, then pixels")).toBeNull());
  });
});
