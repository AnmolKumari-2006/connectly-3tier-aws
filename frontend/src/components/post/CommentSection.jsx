import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Send, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocialData } from "../../context/SocialDataContext";
import { mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";
import { EmojiPanel, EmojiToggle } from "../ui/EmojiPicker";
import { formatFullDate, formatRelativeTime } from "../../utils/formatTime";
import { insertAtCursor } from "../../utils/emoji";
import { cn } from "../../utils/cn";

export default function CommentSection({ postId, onCountChange }) {
  const { user } = useAuth();
  const { commentsByPost, loadComments, addComment, deleteComment, toggleCommentLike } = useSocialData();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef(null);
  const comments = commentsByPost[postId] || [];

  useEffect(() => {
    setLoading(true);
    loadComments(postId).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Report the live count back up to whoever is showing "X comments"
  // (PostCard keeps its own copy so it stays correct regardless of which
  // page's list it was rendered from).
  useEffect(() => {
    if (!loading) onCountChange?.(comments.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length, loading]);

  const insertEmoji = (emoji) => {
    const { value, caret } = insertAtCursor(inputRef.current, draft, emoji);
    setDraft(value);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addComment(postId, draft);
    setDraft("");
    setEmojiOpen(false);
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden"
    >
      <div className="border-t border-border dark:border-border-dark mt-1 pt-3 space-y-3">
        {loading && <p className="text-xs text-ink-muted text-center py-2">Loading comments…</p>}

        <AnimatePresence initial={false}>
          {!loading &&
            comments.map((c) => {
              const author = c.author;
              if (!author) return null;
              const canDelete = author.id === user?.id;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5"
                >
                  <Avatar src={mediaUrl(author.avatar)} alt={author.fullName} size="xs" />
                  <div className="flex-1 min-w-0">
                    <div className="relative inline-block max-w-full">
                      <div className="bg-surface-light dark:bg-white/5 rounded-2xl px-3.5 py-2">
                        <p className="text-xs font-semibold text-ink dark:text-ink-inverted">
                          {author.fullName}
                        </p>
                        <p className="text-sm text-ink dark:text-ink-inverted break-words">{c.text}</p>
                      </div>
                      {c.likeCount > 0 && (
                        <span
                          className="absolute -bottom-2 -right-2 flex items-center gap-0.5 rounded-full bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark shadow-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted"
                          aria-label={`${c.likeCount} likes`}
                        >
                          <Heart size={10} className="fill-red-500 text-red-500" />
                          {c.likeCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 ml-3.5">
                      <button
                        onClick={() => toggleCommentLike(postId, c.id)}
                        aria-pressed={c.likedByMe}
                        aria-label={c.likedByMe ? "Unlike comment" : "Like comment"}
                        className={cn(
                          "text-[11px] font-semibold transition-colors",
                          c.likedByMe ? "text-red-500" : "text-ink-muted hover:text-red-500"
                        )}
                      >
                        {c.likedByMe ? "Liked" : "Like"}
                      </button>
                      <time
                        dateTime={c.createdAt}
                        title={formatFullDate(c.createdAt)}
                        className="text-[11px] text-ink-muted"
                      >
                        {formatRelativeTime(c.createdAt)}
                      </time>
                      {canDelete && (
                        <button
                          onClick={() => deleteComment(postId, c.id)}
                          className="text-[11px] text-ink-muted hover:text-red-500 flex items-center gap-0.5"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          {!loading && comments.length === 0 && (
            <p className="text-xs text-ink-muted text-center py-2">
              No comments yet — be the first to say something.
            </p>
          )}
        </AnimatePresence>

        <EmojiPanel open={emojiOpen} onSelect={insertEmoji} />

        <form onSubmit={submit} className="flex items-center gap-2 pt-1">
          <Avatar src={mediaUrl(user?.avatar)} alt={user?.fullName} size="xs" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment…"
            maxLength={500}
            className="input flex-1 !py-2 !rounded-full"
            aria-label="Write a comment"
          />
          <EmojiToggle open={emojiOpen} onClick={() => setEmojiOpen((v) => !v)} />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Post comment"
            className="w-9 h-9 shrink-0 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary-dark transition"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
