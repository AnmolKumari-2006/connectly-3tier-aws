import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import SearchBar from "../search/SearchBar";
import FriendRequestCard from "../users/FriendRequestCard";
import SuggestedUsers from "../users/SuggestedUsers";
import { TrendingTopics, UpcomingEvents } from "../trending/TrendingCard";
import { useAuth } from "../../context/AuthContext";
import { useSocialData } from "../../context/SocialDataContext";

export default function RightSidebar() {
  const { user } = useAuth();
  const { incomingRequests, acceptIncomingRequest, rejectIncomingRequest } = useSocialData();

  if (!user) return null;

  return (
    <aside className="hidden xl:flex flex-col w-80 shrink-0 h-screen sticky top-0 overflow-y-auto no-scrollbar px-4 py-5 gap-4">
      <SearchBar />

      {incomingRequests.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-bold text-sm text-ink dark:text-ink-inverted">
              Friend Requests
            </h3>
            <Link to="/friends" className="text-xs font-semibold text-primary dark:text-accent hover:underline">
              See all
            </Link>
          </div>
          <div className="divide-y divide-border dark:divide-border-dark">
            <AnimatePresence initial={false}>
              {incomingRequests.map((r) => (
                <FriendRequestCard
                  key={r.requestId}
                  person={r.user}
                  mutual={r.mutual}
                  onAccept={() => acceptIncomingRequest(r.user.id)}
                  onReject={() => rejectIncomingRequest(r.user.id)}
                  compact
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-bold text-sm text-ink dark:text-ink-inverted">
            People You May Know
          </h3>
          <Link to="/friends" className="text-xs font-semibold text-primary dark:text-accent hover:underline">
            See all
          </Link>
        </div>
        <SuggestedUsers limit={3} />
      </div>

      <TrendingTopics />
      <UpcomingEvents />

      <p className="text-[11px] text-ink-muted px-1 pb-4">
        © 2026 Connectly · Full-stack demo project
      </p>
    </aside>
  );
}
