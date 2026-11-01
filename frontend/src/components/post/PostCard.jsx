import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe2,
  Users,
  Lock,
  MoreHorizontal,
  MessageCircle,
  Bookmark,
  Play,
  Trash2,
  Pencil,
  Flag,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useOnClickOutside } from "../../hooks/useOnClickOutside";
import { formatFullDate, formatRelativeTime } from "../../utils/formatTime";
import { postsApi, mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";
import PostImages from "./PostImages";
import LikeButton from "./LikeButton";
import ShareButton from "./ShareButton";
import RichText from "../ui/RichText";
import CommentSection from "./CommentSection";
import { cn } from "../../utils/cn";

const PRIVACY_META = {
  public: { icon: Globe2, label: "Public" },
  friends: { icon: Users, label: "Friends Only" },
  only_me: { icon: Lock, label: "Only Me" },
};

/**
 * PostCard owns its like/bookmark/comment-count state locally and talks to
 * the API directly, rather than only updating a shared context array.
 * Reason: this same component renders posts sourced from three different
 * lists (Home's feed, Explore's list, a Profile's list) that each live in
 * their own local state. If liking only patched one shared array, the
 * click would "work" (the API call succeeds) but the heart on Explore or
 * a Profile page would never visibly fill in, because that page was
 * reading from its own separate array the whole time. Owning the state
 * here means every card is correct regardless of where it's rendered.
 */
export default function PostCard({ post, onDeleted }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [postState, setPostState] = useState(post);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useOnClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  // Keep in sync if the parent ever swaps in a fresher copy of this post
  // (e.g. a full list refetch), but don't let that clobber an in-flight
  // optimistic update.
  useEffect(() => {
    setPostState(post);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const author = postState.author;
  if (!author) return null;

  const PrivacyIcon = PRIVACY_META[postState.privacy]?.icon || Globe2;
  const isOwner = author.id === user?.id;
  const likerAvatars = (postState.likedAvatars || []).slice(0, 3);

  const toggleLike = async () => {
    // Optimistic update first so the heart responds instantly.
    setPostState((p) => ({
      ...p,
      likedByMe: !p.likedByMe,
      likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1,
    }));
    try {
      const { liked, likeCount } = await postsApi.toggleLike(postState.id);
      setPostState((p) => ({ ...p, likedByMe: liked, likeCount }));
    } catch (err) {
      // Roll back on failure.
      setPostState((p) => ({
        ...p,
        likedByMe: !p.likedByMe,
        likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1,
      }));
      showToast(err.message, "warning");
    }
  };

  const toggleBookmark = async () => {
    setPostState((p) => ({ ...p, bookmarkedByMe: !p.bookmarkedByMe }));
    try {
      const { bookmarked } = await postsApi.toggleBookmark(postState.id);
      setPostState((p) => ({ ...p, bookmarkedByMe: bookmarked }));
      showToast(bookmarked ? "Saved to bookmarks" : "Removed from bookmarks", "info");
    } catch (err) {
      setPostState((p) => ({ ...p, bookmarkedByMe: !p.bookmarkedByMe }));
      showToast(err.message, "warning");
    }
  };

  const handleDelete = async () => {
    try {
      await postsApi.remove(postState.id);
      showToast("Post deleted", "info");
      onDeleted?.(postState.id);
    } catch (err) {
      showToast(err.message, "warning");
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="card p-4 sm:p-5"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to={`/profile/${author.username}`}>
          <Avatar src={mediaUrl(author.avatar)} alt={author.fullName} size="md" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={`/profile/${author.username}`}
            className="font-semibold text-[15px] text-ink dark:text-ink-inverted hover:text-primary dark:hover:text-accent"
          >
            {author.fullName}
          </Link>
          {(postState.feeling || postState.location) && (
            <span className="text-[13px] text-ink-muted">
              {postState.feeling && <> is feeling {postState.feeling}</>}
              {postState.location && <> {postState.feeling ? "at" : "is at"} 📍 {postState.location}</>}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span>@{author.username}</span>
            <span aria-hidden="true">·</span>
            <Link to={`/post/${postState.id}`} className="hover:underline">
              <time dateTime={postState.createdAt} title={formatFullDate(postState.createdAt)}>
                {formatRelativeTime(postState.createdAt)}
              </time>
            </Link>
            <span aria-hidden="true">·</span>
            <PrivacyIcon size={12} aria-label={PRIVACY_META[postState.privacy]?.label} />
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="icon-btn"
            aria-label="Post options"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={18} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.1 } }}
                className="absolute right-0 top-full mt-1 w-44 card p-1.5 z-20"
              >
                {isOwner ? (
                  <>
                    <button
                      onClick={() => {
                        showToast("Edit post coming soon", "info");
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink dark:text-ink-inverted hover:bg-surface-light dark:hover:bg-white/5"
                    >
                      <Pencil size={15} /> Edit post
                    </button>
                    <button
                      onClick={() => {
                        handleDelete();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 size={15} /> Delete post
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      showToast("Post reported", "info");
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink dark:text-ink-inverted hover:bg-surface-light dark:hover:bg-white/5"
                  >
                    <Flag size={15} /> Report post
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      {postState.text && (
        <p className="mt-3 text-[15px] leading-relaxed text-ink dark:text-ink-inverted whitespace-pre-wrap break-words">
          <RichText text={postState.text} />
        </p>
      )}

      {postState.images?.length > 0 && (
        <div className="mt-3">
          <PostImages images={postState.images.map(mediaUrl)} />
        </div>
      )}

      {postState.video && (
        <div className="mt-3 relative rounded-xl2 overflow-hidden bg-black">
          <img src={mediaUrl(postState.video.poster)} alt="" className="w-full max-h-[420px] object-cover opacity-90" />
          <button
            onClick={() => showToast("Video playback is a UI preview only", "info")}
            aria-label="Play video"
            className="absolute inset-0 flex items-center justify-center group"
          >
            <span className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Play size={26} className="text-primary ml-1" fill="currentColor" />
            </span>
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border dark:border-border-dark text-xs text-ink-muted">
        <div className="flex items-center gap-1.5">
          {likerAvatars.length > 0 && (
            <span className="flex -space-x-2">
              {likerAvatars.map((avatarUrl, i) => (
                <img
                  key={i}
                  src={mediaUrl(avatarUrl)}
                  alt=""
                  className="w-5 h-5 rounded-full ring-2 ring-surface-card dark:ring-surface-dark-card object-cover"
                />
              ))}
            </span>
          )}
          <span>{postState.likeCount.toLocaleString()} like{postState.likeCount === 1 ? "" : "s"}</span>
        </div>
        <button onClick={() => setCommentsOpen((v) => !v)} className="hover:underline">
          {postState.commentCount} comment{postState.commentCount === 1 ? "" : "s"}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          <LikeButton liked={postState.likedByMe} onToggle={toggleLike} />
          <button
            onClick={() => setCommentsOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors",
              commentsOpen
                ? "text-primary dark:text-accent bg-primary/[0.07] dark:bg-accent/[0.07]"
                : "text-ink-muted hover:text-primary dark:hover:text-accent hover:bg-primary/[0.07] dark:hover:bg-accent/[0.07]"
            )}
          >
            <MessageCircle size={18} />
            <span>Comment</span>
          </button>
          <ShareButton postId={postState.id} />
        </div>
        <button
          onClick={toggleBookmark}
          aria-pressed={postState.bookmarkedByMe}
          aria-label={postState.bookmarkedByMe ? "Remove bookmark" : "Save post"}
          className={cn("icon-btn", postState.bookmarkedByMe && "text-accent")}
        >
          <Bookmark size={18} className={cn(postState.bookmarkedByMe && "fill-current")} />
        </button>
      </div>

      <AnimatePresence>
        {commentsOpen && (
          <CommentSection
            postId={postState.id}
            onCountChange={(count) => setPostState((p) => ({ ...p, commentCount: count }))}
          />
        )}
      </AnimatePresence>
    </motion.article>
  );
}
