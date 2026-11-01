import { Image as ImageIcon, Video, Smile, MapPin } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCreatePostModal } from "../../context/CreatePostModalContext";
import { mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";

export default function PostComposer({ onCreated }) {
  const { user } = useAuth();
  const { openModal } = useCreatePostModal();
  if (!user) return null;

  const open = () => openModal(onCreated);

  return (
    <div className="card p-4 sm:p-4">
      <div className="flex items-center gap-3">
        <Avatar src={mediaUrl(user.avatar)} alt={user.fullName} size="md" />
        <button
          onClick={open}
          className="flex-1 text-left input !rounded-full !py-2.5 text-ink-muted hover:bg-surface-light dark:hover:bg-white/10 transition"
        >
          What's on your mind, {user.fullName.split(" ")[0]}?
        </button>
      </div>
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border dark:border-border-dark">
        <QuickAction icon={ImageIcon} label="Photo" color="text-emerald-500" onClick={open} />
        <QuickAction icon={Video} label="Video" color="text-red-500" onClick={open} />
        <QuickAction icon={Smile} label="Feeling" color="text-amber-500" onClick={open} />
        <QuickAction icon={MapPin} label="Location" color="text-accent" onClick={open} />
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-ink-muted hover:bg-surface-light dark:hover:bg-white/5 transition-colors"
    >
      <Icon size={17} className={color} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
