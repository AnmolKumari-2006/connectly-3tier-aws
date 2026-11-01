import { AnimatePresence, motion } from "framer-motion";
import { Rss } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocialData } from "../context/SocialDataContext";
import { getGreeting } from "../utils/greeting";
import StoryList from "../components/stories/StoryList";
import PostComposer from "../components/post/PostComposer";
import PostCard from "../components/post/PostCard";
import { SkeletonFeed } from "../components/ui/SkeletonLoader";

export default function Home() {
  const { user } = useAuth();
  const { posts, feedLoading, removePostFromFeed } = useSocialData();

  if (!user) return null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display font-extrabold text-2xl text-ink dark:text-ink-inverted">
          {getGreeting()}, {user.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-ink-muted mt-0.5">See what's happening in your circle.</p>
      </div>

      <div className="mb-5">
        <StoryList />
      </div>

      <div className="mb-5">
        <PostComposer />
      </div>

      {feedLoading ? (
        <SkeletonFeed count={3} />
      ) : posts.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onDeleted={removePostFromFeed} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function EmptyFeed() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center text-center py-16 px-6"
    >
      <span className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-4">
        <Rss size={24} />
      </span>
      <h3 className="font-display font-bold text-lg text-ink dark:text-ink-inverted">
        Your feed is quiet right now
      </h3>
      <p className="text-sm text-ink-muted mt-1 max-w-xs">
        Add some friends or write your first post to get things going.
      </p>
    </motion.div>
  );
}
