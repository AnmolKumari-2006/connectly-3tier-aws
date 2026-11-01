import { useEffect, useRef, useState } from "react";
import { Share2, Link2, Send, Loader2, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnClickOutside } from "../../hooks/useOnClickOutside";
import { useToast } from "../../context/ToastContext";
import { friendsApi, messagesApi, mediaUrl } from "../../api/client";
import Modal from "../ui/Modal";
import Avatar from "../ui/Avatar";

/** Permanent link to a single post (opens the /post/:id page). */
function postLink(postId) {
  return `${window.location.origin}/post/${postId}`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for browsers without the async clipboard API.
  const area = document.createElement("textarea");
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

export default function ShareButton({ postId }) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef(null);
  const { showToast } = useToast();
  useOnClickOutside(ref, () => setOpen(false), open);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-ink-muted hover:text-primary dark:hover:text-accent hover:bg-primary/[0.07] dark:hover:bg-accent/[0.07] transition-colors"
      >
        <Share2 size={18} />
        <span>Share</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 bottom-full mb-2 w-52 card p-1.5 z-20"
          >
            <button
              onClick={async () => {
                setOpen(false);
                try {
                  await copyText(postLink(postId));
                  showToast("Link to the post copied");
                } catch {
                  showToast("Couldn't copy the link", "warning");
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink dark:text-ink-inverted hover:bg-surface-light dark:hover:bg-white/5"
            >
              <Link2 size={15} /> Copy link
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setPickerOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink dark:text-ink-inverted hover:bg-surface-light dark:hover:bg-white/5"
            >
              <Send size={15} /> Send via message
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {pickerOpen && <SendToFriendModal postId={postId} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

/** Pick a friend; the post link is sent to them as a real chat message. */
function SendToFriendModal({ postId, onClose }) {
  const { showToast } = useToast();
  const [friends, setFriends] = useState(null);
  const [query, setQuery] = useState("");
  const [sendingTo, setSendingTo] = useState(null);

  useEffect(() => {
    friendsApi
      .list()
      .then((data) => setFriends(data?.friends || []))
      .catch(() => setFriends([]));
  }, []);

  const send = async (friend) => {
    setSendingTo(friend.id);
    try {
      await messagesApi.send(friend.id, `Check out this post: ${postLink(postId)}`);
      showToast(`Sent to ${friend.fullName}`);
      onClose();
    } catch (err) {
      showToast(err.message, "warning");
      setSendingTo(null);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (friends || []).filter(
    (f) => !q || f.fullName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
  );

  return (
    <Modal open onClose={onClose} title="Send to a friend" maxWidth="max-w-sm">
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search friends…"
          className="input pl-9"
        />
      </div>
      {friends === null ? (
        <div className="flex justify-center py-6 text-ink-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-6">
          {friends.length === 0 ? "You don't have any friends to send this to yet." : "No friends match your search."}
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto -mx-1">
          {shown.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => send(f)}
                disabled={sendingTo !== null}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-light dark:hover:bg-white/5 disabled:opacity-60"
              >
                <Avatar src={mediaUrl(f.avatar)} alt={f.fullName} size="sm" />
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-sm font-medium text-ink dark:text-ink-inverted truncate">{f.fullName}</span>
                  <span className="block text-xs text-ink-muted truncate">@{f.username}</span>
                </span>
                {sendingTo === f.id ? <Loader2 size={16} className="animate-spin text-accent" /> : <Send size={15} className="text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
