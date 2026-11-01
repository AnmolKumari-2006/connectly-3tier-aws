import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, Clock, TrendingUp, ArrowUpRight, Hash } from "lucide-react";
import Avatar from "../ui/Avatar";
import { usersApi, postsApi, mediaUrl } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useOnClickOutside } from "../../hooks/useOnClickOutside";

/**
 * Shared search experience. `variant="dropdown"` anchors under an input
 * (desktop right sidebar); `variant="fullscreen"` covers the viewport
 * (mobile, triggered from the header search icon).
 *
 * People come from GET /api/users/search, trending hashtags from
 * GET /api/posts/trending. Recent searches are the user's own searches,
 * remembered in this browser (per account).
 */
const MAX_RECENT = 6;
const recentKey = (userId) => `connectly:recent-searches:${userId}`;

function loadRecent(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(recentKey(userId)) || "[]");
    return Array.isArray(list) ? list.filter((t) => typeof t === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(userId, list) {
  try {
    localStorage.setItem(recentKey(userId), JSON.stringify(list));
  } catch {
    /* storage full or blocked: recent searches just won't persist */
  }
}

export default function SearchOverlay({ variant = "dropdown", open, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const { user } = useAuth();
  const [recent, setRecent] = useState(() => (user ? loadRecent(user.id) : []));
  const [trending, setTrending] = useState([]);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useOnClickOutside(containerRef, () => variant === "dropdown" && onClose(), open);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      usersApi.search(q).then((data) => setResults(data.results)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    postsApi
      .trending()
      .then((d) => setTrending(d?.hashtags || []))
      .catch(() => setTrending([]));
  }, [open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;

  const remember = (term) => {
    const clean = term.trim();
    if (!clean || !user) return;
    const next = [clean, ...recent.filter((r) => r.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(user.id, next);
  };

  const clearRecent = () => {
    setRecent([]);
    if (user) saveRecent(user.id, []);
  };

  const openHashtag = (tag) => {
    remember(`#${tag}`);
    navigate(`/explore?tag=${encodeURIComponent(tag)}`);
    setQuery("");
    onClose();
  };

  // A "#tag" search opens the hashtag page; anything else searches people.
  const commitSearch = (term) => {
    const clean = term.trim();
    if (!clean) return;
    const tagMatch = clean.match(/^#([A-Za-z0-9_]{1,50})$/);
    if (tagMatch) return openHashtag(tagMatch[1]);
    remember(clean);
    setQuery(clean);
  };

  const goToProfile = (username) => {
    remember(query);
    navigate(`/profile/${username}`);
    onClose();
  };

  const content = (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitSearch(query)}
            placeholder="Search users on Connectly…"
            className="input pl-10"
            aria-label="Search Connectly"
          />
        </div>
        {variant === "fullscreen" && (
          <button onClick={onClose} className="icon-btn" aria-label="Close search">
            <X size={19} />
          </button>
        )}
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-1 pb-2">
        {!hasQuery && (
          <>
            {recent.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <SectionLabel icon={Clock} label="Recent searches" />
                  <button onClick={clearRecent} className="text-xs text-ink-muted hover:text-ink dark:hover:text-ink-inverted px-2">
                    Clear
                  </button>
                </div>
                <ul className="mb-4">
                  {recent.map((term) => (
                    <li key={term}>
                      <button
                        onClick={() => commitSearch(term)}
                        className="w-full text-left px-2 py-2 rounded-lg text-sm text-ink dark:text-ink-inverted hover:bg-surface-light dark:hover:bg-white/5 flex items-center justify-between group"
                      >
                        {term}
                        <ArrowUpRight size={14} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {trending.length > 0 && (
              <>
                <SectionLabel icon={TrendingUp} label="Trending hashtags" />
                <ul className="flex flex-wrap gap-2 px-2">
                  {trending.map((t) => (
                    <li key={t.tag}>
                      <button
                        onClick={() => openHashtag(t.tag)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-light dark:bg-white/5 text-ink dark:text-ink-inverted hover:bg-accent/10 hover:text-accent transition-colors"
                      >
                        #{t.tag}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {recent.length === 0 && trending.length === 0 && (
              <p className="text-sm text-ink-muted px-2 py-6 text-center">Search for people by name or username, or type a #hashtag.</p>
            )}
          </>
        )}

        {hasQuery && (
          <>
            {/^#[A-Za-z0-9_]{1,50}$/.test(query.trim()) && (
              <button
                onClick={() => openHashtag(query.trim().slice(1))}
                className="w-full flex items-center gap-3 px-2 py-2 mb-2 rounded-lg hover:bg-surface-light dark:hover:bg-white/5 text-left"
              >
                <span className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                  <Hash size={15} />
                </span>
                <span className="text-sm text-ink dark:text-ink-inverted">
                  See posts with <strong>{query.trim()}</strong>
                </span>
              </button>
            )}
            {results.length === 0 ? (
              <p className="text-sm text-ink-muted px-2 py-6 text-center">
                No people found for "{query}"
              </p>
            ) : (
              <>
                <SectionLabel label="People" />
                <ul>
                  {results.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => goToProfile(u.username)}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-light dark:hover:bg-white/5 text-left"
                      >
                        <Avatar src={mediaUrl(u.avatar)} alt={u.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink dark:text-ink-inverted truncate">{u.fullName}</p>
                          <p className="text-xs text-ink-muted truncate">@{u.username}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-surface-light dark:bg-surface-dark p-4 pt-[max(1rem,env(safe-area-inset-top))]"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
          transition={{ duration: 0.16 }}
          className="absolute z-40 mt-2 w-full max-h-[26rem] card p-3 overflow-hidden flex flex-col"
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionLabel({ icon: Icon, label }) {
  return (
    <p className="flex items-center gap-1.5 px-2 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
      {Icon && <Icon size={12} />}
      {label}
    </p>
  );
}
