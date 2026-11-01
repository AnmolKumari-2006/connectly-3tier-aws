import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { postsApi, notificationsApi, friendsApi } from "../api/client";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";

// Owns the pieces of app state that are genuinely global: the home feed,
// per-post comment threads, and notifications. Friend-graph state (incoming
// requests, suggestions, a given profile's friends list) is intentionally
// kept local to the pages that display it (Friends, Profile, RightSidebar)
// since each of those is really its own independent server query — but they
// all go through the same `friendsApi` client, so there is exactly one
// source of truth: the backend database.
const SocialDataContext = createContext(null);

export function SocialDataProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);

  const loadFeed = useCallback(() => {
    setFeedLoading(true);
    return postsApi
      .feed()
      .then((data) => setPosts(data.posts))
      .catch(() => showToast("Couldn't load your feed.", "warning"))
      .finally(() => setFeedLoading(false));
  }, [showToast]);

  const loadNotifications = useCallback(() => {
    return notificationsApi
      .list()
      .then((data) => setNotifications(data.notifications))
      .catch(() => {});
  }, []);

  // Incoming friend requests are shown in two places at once (the
  // always-mounted right sidebar, and the Friends page) — living here
  // instead of as separate local state in each is exactly what makes
  // "accept from either place" reflect everywhere immediately, rather
  // than leaving a stale card behind wherever wasn't touched.
  const loadIncomingRequests = useCallback(() => {
    return friendsApi
      .incoming()
      .then((data) => setIncomingRequests(data.incoming))
      .catch(() => {});
  }, []);

  const acceptIncomingRequest = async (userId) => {
    try {
      await friendsApi.accept(userId);
      setIncomingRequests((list) => list.filter((r) => r.user.id !== userId));
      showToast("Friend request accepted");
      return true;
    } catch (err) {
      showToast(err.message, "warning");
      return false;
    }
  };

  const rejectIncomingRequest = async (userId) => {
    try {
      await friendsApi.reject(userId);
      setIncomingRequests((list) => list.filter((r) => r.user.id !== userId));
      return true;
    } catch (err) {
      showToast(err.message, "warning");
      return false;
    }
  };

  useEffect(() => {
    if (!user) {
      setPosts([]);
      setNotifications([]);
      setIncomingRequests([]);
      return;
    }
    loadFeed();
    loadNotifications();
    loadIncomingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---- Posts ---------------------------------------------------------
  // Note: liking/bookmarking individual posts is handled locally inside
  // PostCard itself (see that component for why) — this context only
  // owns the feed list, comments, and notifications.

  const loadComments = async (postId) => {
    const data = await postsApi.getComments(postId);
    setCommentsByPost((map) => ({ ...map, [postId]: data.comments }));
  };

  const addComment = async (postId, text) => {
    try {
      const { comment, commentCount } = await postsApi.addComment(postId, text);
      setCommentsByPost((map) => ({ ...map, [postId]: [...(map[postId] || []), comment] }));
      setPosts((list) => list.map((p) => (p.id === postId ? { ...p, commentCount } : p)));
    } catch (err) {
      showToast(err.message, "warning");
    }
  };

  const deleteComment = async (postId, commentId) => {
    try {
      const { commentCount } = await postsApi.deleteComment(commentId);
      setCommentsByPost((map) => ({
        ...map,
        [postId]: (map[postId] || []).filter((c) => c.id !== commentId),
      }));
      setPosts((list) => list.map((p) => (p.id === postId ? { ...p, commentCount } : p)));
    } catch (err) {
      showToast(err.message, "warning");
    }
  };

  const toggleCommentLike = async (postId, commentId) => {
    try {
      const { liked, likeCount } = await postsApi.toggleCommentLike(commentId);
      setCommentsByPost((map) => ({
        ...map,
        [postId]: (map[postId] || []).map((c) =>
          c.id === commentId ? { ...c, likedByMe: liked, likeCount } : c
        ),
      }));
    } catch (err) {
      showToast(err.message, "warning");
    }
  };

  const createPost = async ({ text, privacy, files, feeling, location }) => {
    try {
      const { post } = await postsApi.create({ text, privacy, files, feeling, location });
      setPosts((list) => [post, ...list]);
      showToast("Post published!");
      return post;
    } catch (err) {
      showToast(err.message, "warning");
      throw err;
    }
  };

  const removePostFromFeed = (postId) => {
    setPosts((list) => list.filter((p) => p.id !== postId));
  };

  // ---- Notifications ----------------------------------------------------
  const markNotificationRead = async (id) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await notificationsApi.markRead(id);
    } catch {
      loadNotifications();
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      loadNotifications();
    }
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const value = {
    posts,
    feedLoading,
    commentsByPost,
    notifications,
    unreadCount,
    incomingRequests,
    loadFeed,
    loadComments,
    addComment,
    deleteComment,
    toggleCommentLike,
    createPost,
    removePostFromFeed,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    loadIncomingRequests,
    acceptIncomingRequest,
    rejectIncomingRequest,
  };

  return <SocialDataContext.Provider value={value}>{children}</SocialDataContext.Provider>;
}

export function useSocialData() {
  const ctx = useContext(SocialDataContext);
  if (!ctx) throw new Error("useSocialData must be used within a SocialDataProvider");
  return ctx;
}
