import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, Loader2 } from "lucide-react";
import { mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";
import { cn } from "../../utils/cn";

/**
 * `onAccept`/`onReject` are async functions that do the actual work (call
 * the API and update whatever shared list this request lives in). Kept
 * out of this component so RightSidebar and the Friends page can both
 * point at the same underlying action in SocialDataContext — accepting
 * from either place then updates both instantly instead of leaving a
 * stale card behind wherever wasn't touched.
 */
export default function FriendRequestCard({ person, mutual, onAccept, onReject, compact = false }) {
  const [loading, setLoading] = useState(null); // 'accept' | 'reject' | null
  if (!person) return null;

  const run = async (kind, action) => {
    setLoading(kind);
    await action();
    setLoading(null);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex items-center gap-3", compact ? "py-2.5" : "card p-4")}
    >
      <Link to={`/profile/${person.username}`}>
        <Avatar src={mediaUrl(person.avatar)} alt={person.fullName} size={compact ? "sm" : "md"} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/profile/${person.username}`}
          className={cn(
            "font-semibold text-ink dark:text-ink-inverted hover:text-primary dark:hover:text-accent block truncate",
            compact ? "text-sm" : "text-[15px]"
          )}
        >
          {person.fullName}
        </Link>
        <p className="text-xs text-ink-muted truncate">{mutual} mutual friends</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => run("accept", onAccept)}
          disabled={!!loading}
          aria-label={`Accept ${person.fullName}'s friend request`}
          className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition disabled:opacity-60"
        >
          {loading === "accept" ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
        </button>
        <button
          onClick={() => run("reject", onReject)}
          disabled={!!loading}
          aria-label={`Reject ${person.fullName}'s friend request`}
          className="w-8 h-8 rounded-full border border-border dark:border-border-dark flex items-center justify-center hover:border-red-300 hover:text-red-500 transition disabled:opacity-60"
        >
          {loading === "reject" ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />}
        </button>
      </div>
    </motion.div>
  );
}
