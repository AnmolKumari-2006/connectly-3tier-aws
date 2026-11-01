import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "../../utils/cn";

export default function LikeButton({ liked, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors",
        liked ? "text-red-500" : "text-ink-muted hover:text-red-500",
        "hover:bg-red-500/[0.07]"
      )}
      aria-pressed={liked}
    >
      <motion.span
        key={liked ? "liked" : "unliked"}
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        className="relative inline-flex"
      >
        <Heart size={19} className={cn(liked && "fill-current")} />
        {liked && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0.6 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0 rounded-full bg-red-500/40"
          />
        )}
      </motion.span>
      <span>{liked ? "Liked" : "Like"}</span>
    </button>
  );
}
