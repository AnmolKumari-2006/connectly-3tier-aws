import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell } from "lucide-react";
import ConnectlyLogo from "../brand/ConnectlyLogo";
import SearchOverlay from "../search/SearchOverlay";
import { useSocialData } from "../../context/SocialDataContext";

export default function MobileHeader() {
  const { unreadCount } = useSocialData();
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4
                   bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md
                   border-b border-border dark:border-border-dark
                   pt-[max(0.6rem,env(safe-area-inset-top))] pb-2.5"
      >
        <button onClick={() => navigate("/")} aria-label="Connectly home">
          <ConnectlyLogo size="sm" />
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setSearchOpen(true)} className="icon-btn" aria-label="Search">
            <Search size={20} />
          </button>
          <button
            onClick={() => navigate("/notifications")}
            className="icon-btn relative"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-surface-light dark:ring-surface-dark" />
            )}
          </button>
        </div>
      </header>
      <SearchOverlay variant="fullscreen" open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
