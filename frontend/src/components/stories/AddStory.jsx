import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";

export default function AddStory({ onClick }) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label="Add story"
      className="flex flex-col items-center gap-1.5 shrink-0 w-16"
    >
      <span className="relative w-16 h-16 rounded-full">
        <Avatar src={mediaUrl(user.avatar)} alt={user.fullName} size="lg" className="opacity-90" />
        <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-accent text-[#04222c] flex items-center justify-center ring-2 ring-surface-card dark:ring-surface-dark-card">
          <Plus size={14} strokeWidth={3} />
        </span>
      </span>
      <span className="text-[11px] text-ink dark:text-ink-inverted">Add Story</span>
    </motion.button>
  );
}
