import { NavLink } from "react-router-dom";
import { Home, Compass, PlusCircle, Bell, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useSocialData } from "../../context/SocialDataContext";
import { useCreatePostModal } from "../../context/CreatePostModalContext";

export default function MobileNav() {
  const { user } = useAuth();
  const { unreadCount } = useSocialData();
  const { openModal } = useCreatePostModal();

  if (!user) return null;

  const ITEMS = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/notifications", label: "Alerts", icon: Bell, badge: true },
    { to: `/profile/${user.username}`, label: "Profile", icon: User },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-card/95 dark:bg-surface-dark-card/95 backdrop-blur-md
                 border-t border-border dark:border-border-dark flex items-center justify-around
                 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5"
      aria-label="Primary"
    >
      {ITEMS.slice(0, 2).map((item) => (
        <MobileNavLink key={item.label} {...item} unreadCount={unreadCount} />
      ))}

      <button
        onClick={openModal}
        aria-label="Create post"
        className="flex flex-col items-center justify-center -mt-5"
      >
        <motion.span
          whileTap={{ scale: 0.88 }}
          className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-soft-hover"
        >
          <PlusCircle size={24} />
        </motion.span>
      </button>

      {ITEMS.slice(2).map((item) => (
        <MobileNavLink key={item.label} {...item} unreadCount={unreadCount} />
      ))}
    </nav>
  );
}

function MobileNavLink({ to, label, icon: Icon, end, badge, unreadCount }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] font-medium"
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon
              size={22}
              strokeWidth={isActive ? 2.4 : 2}
              className={isActive ? "text-accent" : "text-ink-muted"}
            />
            {badge && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-[8px] h-[8px] rounded-full bg-accent ring-2 ring-surface-card dark:ring-surface-dark-card" />
            )}
          </span>
          <span className={isActive ? "text-accent" : "text-ink-muted"}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
