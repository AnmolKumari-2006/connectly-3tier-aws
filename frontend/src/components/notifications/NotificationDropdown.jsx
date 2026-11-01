import { useRef } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { useSocialData } from "../../context/SocialDataContext";
import { useOnClickOutside } from "../../hooks/useOnClickOutside";
import NotificationItem from "./NotificationItem";

export default function NotificationDropdown({ open, onClose }) {
  const { notifications, unreadCount, markAllNotificationsRead, markNotificationRead } =
    useSocialData();
  const ref = useRef(null);
  useOnClickOutside(ref, onClose, open);

  const recent = notifications.slice(0, 6);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
          transition={{ duration: 0.16 }}
          className="absolute right-0 top-full mt-2 w-[22rem] max-w-[90vw] card p-0 overflow-hidden z-40"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark">
            <h3 className="font-display font-bold text-sm text-ink dark:text-ink-inverted flex items-center gap-2">
              <Bell size={15} className="text-accent" /> Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="flex items-center gap-1 text-xs font-semibold text-primary dark:text-accent hover:underline"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-border dark:divide-border-dark">
            {recent.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-8">You're all caught up.</p>
            ) : (
              recent.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  compact
                  onRead={() => markNotificationRead(n.id)}
                />
              ))
            )}
          </div>

          <Link
            to="/notifications"
            onClick={onClose}
            className="block text-center py-3 text-sm font-semibold text-primary dark:text-accent border-t border-border dark:border-border-dark hover:bg-surface-light dark:hover:bg-white/5"
          >
            See all notifications
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
