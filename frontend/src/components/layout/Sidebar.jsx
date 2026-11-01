import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Compass,
  Users,
  Bell,
  MessageCircle,
  Bookmark,
  User,
  Settings,
  PlusCircle,
  LogOut,
} from "lucide-react";
import ConnectlyLogo from "../brand/ConnectlyLogo";
import Avatar from "../ui/Avatar";
import { useAuth } from "../../context/AuthContext";
import { useSocialData } from "../../context/SocialDataContext";
import { useCreatePostModal } from "../../context/CreatePostModalContext";
import { mediaUrl } from "../../api/client";
import { cn } from "../../utils/cn";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocialData();
  const { openModal } = useCreatePostModal();
  const navigate = useNavigate();

  if (!user) return null;

  const NAV_ITEMS = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/friends", label: "Friends", icon: Users },
    { to: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
    { to: "/messages", label: "Messages", icon: MessageCircle },
    { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { to: `/profile/${user.username}`, label: "Profile", icon: User },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-border dark:border-border-dark px-4 py-5">
      <button
        onClick={() => navigate("/")}
        className="px-2 mb-6 focus-visible:outline-none"
        aria-label="Connectly home"
      >
        <ConnectlyLogo size="md" />
      </button>

      <nav className="flex-1 flex flex-col gap-1" aria-label="Primary">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, badgeKey }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[15px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent"
                  : "text-ink-muted hover:bg-surface-light dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-inverted"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.4 : 2}
                    className={isActive ? "text-primary dark:text-accent" : ""}
                  />
                  {badgeKey === "notifications" && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-accent text-[9px] font-bold text-[#04222c] flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button onClick={openModal} className="btn-primary w-full mt-2 mb-4">
        <PlusCircle size={18} />
        Create Post
      </button>

      <div className="flex items-center gap-2 px-1">
        <button
          onClick={() => navigate(`/profile/${user.username}`)}
          className="flex-1 flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-surface-light dark:hover:bg-white/5 transition-colors text-left min-w-0"
        >
          <Avatar
            src={mediaUrl(user.avatar)}
            alt={user.fullName}
            size="sm"
            online={user.settings?.showActivity === false ? undefined : true}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink dark:text-ink-inverted truncate">
              {user.fullName}
            </p>
            <p className="text-xs text-ink-muted truncate">@{user.username}</p>
          </div>
        </button>
        <button onClick={handleLogout} className="icon-btn" aria-label="Log out">
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}
