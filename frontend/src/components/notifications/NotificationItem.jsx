import { Heart, MessageCircle, UserPlus, UserCheck, AtSign, Mail } from "lucide-react";
import { mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";
import { formatFullDate, formatRelativeTime } from "../../utils/formatTime";
import { cn } from "../../utils/cn";

const ICONS = {
  like: { icon: Heart, className: "bg-red-500/10 text-red-500" },
  comment: { icon: MessageCircle, className: "bg-primary/10 text-primary dark:text-accent" },
  friend_request: { icon: UserPlus, className: "bg-accent/10 text-accent" },
  friend_accept: { icon: UserCheck, className: "bg-emerald-500/10 text-emerald-500" },
  mention: { icon: AtSign, className: "bg-violet-500/10 text-violet-500" },
  message: { icon: Mail, className: "bg-blue-500/10 text-blue-500" },
  comment_like: { icon: Heart, className: "bg-red-500/10 text-red-500" },
};

export default function NotificationItem({ notification, compact = false, onRead }) {
  const actor = notification.actor;
  const meta = ICONS[notification.type] || ICONS.like;
  const Icon = meta.icon;

  if (!actor) return null;

  return (
    <button
      onClick={onRead}
      className={cn(
        "w-full flex items-start gap-3 text-left transition-colors",
        compact ? "px-4 py-3" : "px-4 py-4 rounded-xl2",
        !notification.isRead && "bg-accent/[0.06]",
        "hover:bg-surface-light dark:hover:bg-white/5"
      )}
    >
      <span className="relative shrink-0">
        <Avatar src={mediaUrl(actor.avatar)} alt={actor.fullName} size={compact ? "sm" : "md"} />
        <span className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center", meta.className)}>
          <Icon size={11} strokeWidth={2.5} />
        </span>
      </span>

      <div className="flex-1 min-w-0">
        <p className={cn("text-ink dark:text-ink-inverted", compact ? "text-sm" : "text-[15px]")}>
          <span className="font-semibold">{actor.fullName}</span>{" "}
          <span className="text-ink-muted">{notification.message}</span>
        </p>
        <p className="text-xs text-ink-muted mt-0.5" title={formatFullDate(notification.createdAt)}>
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      {!notification.isRead && (
        <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" aria-label="Unread" />
      )}
    </button>
  );
}
