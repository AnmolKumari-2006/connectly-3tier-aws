import { useState } from "react";
import { CheckCheck, BellOff } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import { useSocialData } from "../context/SocialDataContext";
import NotificationItem from "../components/notifications/NotificationItem";
import { cn } from "../utils/cn";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "like", label: "Likes" },
  { key: "comment", label: "Comments" },
  { key: "friend_request", label: "Friend Requests" },
  { key: "message", label: "Messages" },
];

export default function Notifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadCount } =
    useSocialData();
  const [category, setCategory] = useState("all");

  const filtered =
    category === "all"
      ? notifications
      : notifications.filter((n) =>
          category === "friend_request"
            ? n.type === "friend_request" || n.type === "friend_accept"
            : category === "like"
              ? n.type === "like" || n.type === "comment_like"
              : n.type === category
        );

  return (
    <div>
      <Topbar title="Notifications" subtitle="Stay on top of your Connectly activity" />

      <div className="flex items-center justify-between mb-4 lg:hidden">
        <h1 className="font-display font-extrabold text-xl text-ink dark:text-ink-inverted">
          Notifications
        </h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors",
                category === c.key
                  ? "bg-primary text-white"
                  : "bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark text-ink-muted hover:text-ink dark:hover:text-ink-inverted"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-accent hover:underline shrink-0 ml-3"
          >
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      <div className="card divide-y divide-border dark:divide-border-dark overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 px-6">
            <span className="w-11 h-11 rounded-xl bg-surface-light dark:bg-white/5 text-ink-muted flex items-center justify-center mb-3">
              <BellOff size={18} />
            </span>
            <p className="text-sm text-ink-muted">Nothing here yet.</p>
          </div>
        ) : (
          filtered.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={() => markNotificationRead(n.id)} />
          ))
        )}
      </div>
    </div>
  );
}
