import { motion } from "framer-motion";
import { mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";
import { cn } from "../../utils/cn";

// One bubble in the story bar = one person's set of active stories.
export default function Story({ group, onOpen }) {
  const { user, isMine, allViewed } = group;

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onOpen}
      aria-label={isMine ? "View your story" : `View ${user.fullName}'s story`}
      className="flex flex-col items-center gap-1.5 shrink-0 w-16"
    >
      <span
        className={cn(
          "w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-br",
          allViewed && !isMine
            ? "from-border to-border dark:from-border-dark dark:to-border-dark"
            : "from-accent to-primary"
        )}
      >
        <span className="block w-full h-full rounded-full p-[2px] bg-surface-card dark:bg-surface-dark-card">
          <Avatar src={mediaUrl(user.avatar)} alt={user.fullName} size="lg" className="!w-full !h-full" />
        </span>
      </span>
      <span className="text-[11px] text-ink dark:text-ink-inverted truncate w-full text-center">
        {isMine ? "Your story" : user.fullName.split(" ")[0]}
      </span>
    </motion.button>
  );
}
