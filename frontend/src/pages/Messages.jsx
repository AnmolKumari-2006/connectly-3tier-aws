import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Send, MessageCircle, Loader2 } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import { messagesApi, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocialData } from "../context/SocialDataContext";
import RichText from "../components/ui/RichText";
import Avatar from "../components/ui/Avatar";
import { SkeletonUserRow } from "../components/ui/SkeletonLoader";
import { EmojiPanel, EmojiToggle } from "../components/ui/EmojiPicker";
import { formatClockTime, formatFullDate, formatListTime, formatRelativeTime } from "../utils/formatTime";
import { insertAtCursor } from "../utils/emoji";
import { cn } from "../utils/cn";

const POLL_MS = 4000;

export default function Messages() {
  const { user } = useAuth();
  const { loadNotifications } = useSocialData();
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState(null);
  const [activeId, setActiveId] = useState(location.state?.openUserId || null);

  const loadConversations = () => messagesApi.conversations().then((d) => setConversations(d.conversations));

  useEffect(() => {
    loadConversations();
    // Came here from a profile's "Message" button — clear the navigation
    // state so a later back/forward doesn't keep re-opening this thread.
    if (location.state?.openUserId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeConvo = conversations?.find((c) => c.user.id === activeId);

  const handleSent = () => {
    loadConversations();
  };

  return (
    <div>
      <Topbar title="Messages" subtitle="Chat with your friends on Connectly" />

      <div className="card overflow-hidden flex" style={{ height: "calc(100vh - 180px)", minHeight: 480 }}>
        {/* Conversation list — hidden on mobile once a thread is open */}
        <div
          className={cn(
            "w-full sm:w-72 shrink-0 border-r border-border dark:border-border-dark flex flex-col",
            activeId && "hidden sm:flex"
          )}
        >
          <div className="px-4 py-3 border-b border-border dark:border-border-dark">
            <h2 className="font-display font-bold text-sm text-ink dark:text-ink-inverted">Chats</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations === null ? (
              <div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonUserRow key={i} />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-8 px-4">
                Add some friends first to start chatting.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.user.id}
                  onClick={() => setActiveId(c.user.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border dark:border-border-dark hover:bg-surface-light dark:hover:bg-white/5 transition-colors",
                    activeId === c.user.id && "bg-surface-light dark:bg-white/5"
                  )}
                >
                  <Avatar
                    src={mediaUrl(c.user.avatar)}
                    alt={c.user.fullName}
                    size="md"
                    online={c.user.presence ? c.user.presence.online : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink dark:text-ink-inverted truncate">
                        {c.user.fullName}
                      </p>
                      {c.lastMessage && (
                        <span className="text-[10px] text-ink-muted shrink-0">
                          {formatListTime(c.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-xs truncate",
                        c.unreadCount > 0
                          ? "text-ink dark:text-ink-inverted font-medium"
                          : "text-ink-muted"
                      )}
                    >
                      {c.lastMessage
                        ? `${c.lastMessage.senderId === user.id ? "You: " : ""}${c.lastMessage.text}`
                        : "Say hello 👋"}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-accent text-[10px] font-bold text-[#04222c] flex items-center justify-center shrink-0">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={cn("flex-1 flex flex-col min-w-0", !activeId && "hidden sm:flex")}>
          {activeConvo ? (
            <ChatThread
              key={activeConvo.user.id}
              person={activeConvo.user}
              onBack={() => setActiveId(null)}
              onSent={handleSent}
              onMarkedRead={loadNotifications}
            />
          ) : (
            <div className="flex-1 hidden sm:flex flex-col items-center justify-center text-center px-6">
              <span className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-4">
                <MessageCircle size={24} />
              </span>
              <h3 className="font-display font-bold text-lg text-ink dark:text-ink-inverted">
                Select a conversation
              </h3>
              <p className="text-sm text-ink-muted mt-1 max-w-xs">
                Pick a friend from the list to start chatting.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatThread({ person, onBack, onSent, onMarkedRead }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

  const loadThread = (silent = false) => {
    if (!silent) setMessages(null);
    return messagesApi.thread(person.id).then((d) => setMessages(d.messages));
  };

  useEffect(() => {
    loadThread().then(() => {
      messagesApi.markRead(person.id).then(() => onMarkedRead?.());
    });

    pollRef.current = setInterval(() => loadThread(true), POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const insertEmoji = (emoji) => {
    const { value, caret } = insertAtCursor(inputRef.current, draft, emoji);
    setDraft(value);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    setEmojiOpen(false);
    try {
      const { message } = await messagesApi.send(person.id, text);
      setMessages((list) => [...(list || []), message]);
      onSent?.();
    } finally {
      setSending(false);
    }
  };

  const patchMessage = (id, patch) =>
    setMessages((list) => (list || []).map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const toggleLike = async (m) => {
    // Optimistic, then reconcile with what the server says.
    patchMessage(m.id, {
      likedByMe: !m.likedByMe,
      likeCount: m.likedByMe ? m.likeCount - 1 : m.likeCount + 1,
    });
    try {
      const { liked, likeCount } = await messagesApi.toggleLike(m.id);
      patchMessage(m.id, { likedByMe: liked, likeCount });
    } catch {
      patchMessage(m.id, { likedByMe: m.likedByMe, likeCount: m.likeCount });
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border dark:border-border-dark shrink-0">
        <button onClick={onBack} className="icon-btn sm:hidden" aria-label="Back to conversations">
          <ArrowLeft size={18} />
        </button>
        <Avatar
          src={mediaUrl(person.avatar)}
          alt={person.fullName}
          size="sm"
          online={person.presence ? person.presence.online : undefined}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-ink-inverted truncate">{person.fullName}</p>
          <p className="text-xs text-ink-muted truncate">
            {person.presence
              ? person.presence.online
                ? "Active now"
                : person.presence.lastSeenAt
                  ? `Active ${formatRelativeTime(person.presence.lastSeenAt)}`
                  : `@${person.username}`
              : `@${person.username}`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages === null ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-ink-muted" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-8">
            No messages yet — say hello to {person.fullName.split(" ")[0]}!
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === user.id;
            return (
              <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                <div className={cn("group relative max-w-[75%]", m.likeCount > 0 && "mb-2.5")}>
                  <div
                    onDoubleClick={() => toggleLike(m)}
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm break-words select-text",
                      isMine
                        ? "bg-primary text-white rounded-br-md"
                        : "bg-surface-light dark:bg-white/5 text-ink dark:text-ink-inverted rounded-bl-md"
                    )}
                  >
                    <RichText text={m.text} linkClassName="underline font-medium break-all" />
                    <time
                      dateTime={m.createdAt}
                      title={formatFullDate(m.createdAt)}
                      className={cn("block text-[10px] mt-1", isMine ? "text-white/70" : "text-ink-muted")}
                    >
                      {formatClockTime(m.createdAt)}
                    </time>
                  </div>

                  {m.likeCount > 0 && (
                    <span
                      className={cn(
                        "absolute -bottom-2.5 flex items-center gap-0.5 rounded-full bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark shadow-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted",
                        isMine ? "right-2" : "left-2"
                      )}
                      aria-label={`${m.likeCount} likes`}
                    >
                      <Heart size={10} className="fill-red-500 text-red-500" />
                      {m.likeCount}
                    </span>
                  )}

                  <button
                    onClick={() => toggleLike(m)}
                    aria-pressed={m.likedByMe}
                    aria-label={m.likedByMe ? "Unlike message" : "Like message"}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center",
                      "bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark shadow-soft",
                      "transition-opacity opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100",
                      isMine ? "right-full mr-1.5" : "left-full ml-1.5"
                    )}
                  >
                    <Heart size={13} className={m.likedByMe ? "fill-red-500 text-red-500" : "text-ink-muted"} />
                  </button>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border dark:border-border-dark shrink-0">
        <div className="px-4">
          <EmojiPanel open={emojiOpen} onSelect={insertEmoji} />
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3">
          <EmojiToggle open={emojiOpen} onClick={() => setEmojiOpen((v) => !v)} />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${person.fullName.split(" ")[0]}…`}
            maxLength={2000}
            className="input flex-1 !rounded-full"
            aria-label="Write a message"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="w-10 h-10 shrink-0 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary-dark transition"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </>
  );
}
