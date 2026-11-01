import { useState } from "react";
import { Bell, Search } from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";
import NotificationDropdown from "../notifications/NotificationDropdown";
import SearchOverlay from "../search/SearchOverlay";
import { useSocialData } from "../../context/SocialDataContext";

export default function Topbar({ title, subtitle }) {
  const { unreadCount } = useSocialData();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="hidden lg:flex items-center justify-between mb-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-ink dark:text-ink-inverted">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="icon-btn xl:hidden"
          aria-label="Search"
        >
          <Search size={19} />
        </button>
        <ThemeToggle />
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="icon-btn relative"
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-[2px] rounded-full bg-accent text-[9px] font-bold text-[#04222c] flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <NotificationDropdown open={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>
      </div>

      <SearchOverlay variant="fullscreen" open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
