import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Flame, Hash, X } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import SearchBar from "../components/search/SearchBar";
import { postsApi, usersApi, mediaUrl } from "../api/client";
import UserCard from "../components/users/UserCard";
import PostCard from "../components/post/PostCard";
import { parseServerDate } from "../utils/formatTime";
import { SkeletonFeed, SkeletonUserRow } from "../components/ui/SkeletonLoader";

export default function Explore() {
  const [posts, setPosts] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [tab, setTab] = useState("popular");
  const [trending, setTrending] = useState([]);
  // ?tag=Photography shows the posts that use that hashtag.
  const [searchParams, setSearchParams] = useSearchParams();
  const tag = searchParams.get("tag") || "";
  const [tagged, setTagged] = useState({ tag: null, posts: null });
  const navigate = useNavigate();

  useEffect(() => {
    postsApi.explore().then((d) => setPosts(d.posts)).catch(() => setPosts([]));
    usersApi.suggestions().then((d) => setSuggestions(d.suggestions.slice(0, 4))).catch(() => setSuggestions([]));
    postsApi.trending().then((d) => setTrending(d?.hashtags || [])).catch(() => setTrending([]));
  }, []);

  useEffect(() => {
    if (!tag) return;
    let cancelled = false;
    postsApi
      .byHashtag(tag)
      .then((d) => !cancelled && setTagged({ tag, posts: d.posts }))
      .catch(() => !cancelled && setTagged({ tag, posts: [] }));
    return () => {
      cancelled = true;
    };
  }, [tag]);

  const taggedPosts = tagged.tag === tag ? tagged.posts : null;

  const sorted = posts
    ? [...posts].sort((a, b) =>
        tab === "popular" ? b.likeCount - a.likeCount : parseServerDate(b.createdAt) - parseServerDate(a.createdAt)
      )
    : [];

  const mediaPosts = (posts || []).filter((p) => p.images?.length);

  return (
    <div>
      <Topbar title="Explore" subtitle="Discover posts and people across Connectly" />

      <div className="mb-4">
        <SearchBar />
      </div>

      {/* Trending hashtags, counted from real public posts */}
      {trending.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-0.5 px-0.5">
          {trending.map((t) => {
            const active = tag.toLowerCase() === t.tag.toLowerCase();
            return (
              <button
                key={t.tag}
                onClick={() => setSearchParams(active ? {} : { tag: t.tag })}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-white border-primary"
                    : "bg-surface-card dark:bg-surface-dark-card border-border dark:border-border-dark text-ink dark:text-ink-inverted hover:border-accent hover:text-accent"
                }`}
              >
                <Flame size={14} className={active ? "text-white" : "text-accent"} />#{t.tag}
                <span className={active ? "text-white/80 text-xs" : "text-ink-muted text-xs"}>{t.posts}</span>
              </button>
            );
          })}
        </div>
      )}

      {tag && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-1.5 font-display font-bold text-lg text-ink dark:text-ink-inverted">
              <Hash size={18} className="text-accent" />
              {tag}
            </h2>
            <button onClick={() => setSearchParams({})} className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink dark:hover:text-ink-inverted">
              <X size={15} /> Clear
            </button>
          </div>
          {taggedPosts === null ? (
            <SkeletonFeed count={1} />
          ) : taggedPosts.length === 0 ? (
            <div className="card text-center py-10 px-6">
              <p className="text-sm text-ink-muted">No posts you can see use #{tag} yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {taggedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDeleted={(id) => setTagged((t) => ({ ...t, posts: t.posts.filter((p) => p.id !== id) }))}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!tag && (
      <>
      {/* Suggested people row */}
      <section className="mb-6">
        <h2 className="font-display font-bold text-lg text-ink dark:text-ink-inverted mb-3">
          Suggested for you
        </h2>
        {suggestions === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4"><SkeletonUserRow /></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {suggestions.map((u) => (
              <UserCard key={u.id} person={u} />
            ))}
          </div>
        )}
      </section>

      {/* Media grid — Pinterest-style */}
      {mediaPosts.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display font-bold text-lg text-ink dark:text-ink-inverted mb-3">Media</h2>
          <div className="columns-2 sm:columns-3 gap-3 [&>*]:mb-3">
            {mediaPosts.map((p) =>
              p.images.map((src, i) => (
                <button
                  key={`${p.id}-${i}`}
                  onClick={() => navigate(`/post/${p.id}`)}
                  className="block w-full rounded-xl2 overflow-hidden break-inside-avoid group"
                >
                  <img
                    src={mediaUrl(src)}
                    alt=""
                    loading="lazy"
                    className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {/* Popular / latest posts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg text-ink dark:text-ink-inverted">Posts</h2>
          <div className="flex gap-1 bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-full p-1">
            {["popular", "latest"].map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                  tab === key ? "bg-primary text-white" : "text-ink-muted hover:text-ink dark:hover:text-ink-inverted"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {posts === null ? (
          <SkeletonFeed count={2} />
        ) : sorted.length === 0 ? (
          <div className="card text-center py-12 px-6">
            <p className="text-sm text-ink-muted">No public posts yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={(id) => setPosts((list) => list.filter((p) => p.id !== id))}
              />
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
}
