import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import { postsApi } from "../api/client";
import PostCard from "../components/post/PostCard";
import { SkeletonFeed } from "../components/ui/SkeletonLoader";

export default function Bookmarks() {
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    postsApi.bookmarks().then((d) => setPosts(d.posts)).catch(() => setPosts([]));
  }, []);

  return (
    <div>
      <Topbar title="Bookmarks" subtitle="Posts you've saved for later" />

      {posts === null ? (
        <SkeletonFeed count={2} />
      ) : posts.length === 0 ? (
        <div className="card flex flex-col items-center text-center py-16 px-6">
          <span className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-4">
            <Bookmark size={24} />
          </span>
          <h3 className="font-display font-bold text-lg text-ink dark:text-ink-inverted">
            No bookmarks yet
          </h3>
          <p className="text-sm text-ink-muted mt-1 max-w-xs">
            Tap the bookmark icon on any post to save it here for later.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onDeleted={(id) => setPosts((list) => list.filter((post) => post.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
