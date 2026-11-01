import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { UserX } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import { friendsApi, usersApi } from "../api/client";
import { useSocialData } from "../context/SocialDataContext";
import FriendRequestCard from "../components/users/FriendRequestCard";
import UserCard from "../components/users/UserCard";
import { SkeletonUserRow } from "../components/ui/SkeletonLoader";

export default function Friends() {
  // Incoming requests are shared app-wide (see SocialDataContext) so that
  // accepting/rejecting here is instantly reflected in the right sidebar
  // too, and vice versa — no more stale cards left behind in one place
  // after resolving a request in the other.
  const { incomingRequests, acceptIncomingRequest, rejectIncomingRequest } = useSocialData();

  const [sent, setSent] = useState(null);
  const [friends, setFriends] = useState(null);
  const [suggestions, setSuggestions] = useState(null);

  const loadFriendsList = () => friendsApi.list().then((d) => setFriends(d.friends));

  useEffect(() => {
    friendsApi.sent().then((d) => setSent(d.sent));
    loadFriendsList();
    usersApi.suggestions().then((d) => setSuggestions(d.suggestions));
  }, []);

  const removeSent = (requestId) => setSent((list) => list.filter((r) => r.requestId !== requestId));

  const handleAccept = async (userId) => {
    const ok = await acceptIncomingRequest(userId);
    if (ok) loadFriendsList(); // the new friend should now show up below
  };

  return (
    <div>
      <Topbar title="Friends" subtitle="Manage your connections on Connectly" />

      <section className="mb-8">
        <h2 className="font-display font-bold text-lg text-ink dark:text-ink-inverted mb-3">
          Friend Requests {incomingRequests.length > 0 && `(${incomingRequests.length})`}
        </h2>
        {incomingRequests.length === 0 ? (
          <EmptyState message="No pending friend requests." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <AnimatePresence initial={false}>
              {incomingRequests.map((r) => (
                <FriendRequestCard
                  key={r.requestId}
                  person={r.user}
                  mutual={r.mutual}
                  onAccept={() => handleAccept(r.user.id)}
                  onReject={() => rejectIncomingRequest(r.user.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-display font-bold text-lg text-ink dark:text-ink-inverted mb-3">Sent Requests</h2>
        {sent === null ? (
          <SectionSkeleton />
        ) : sent.length === 0 ? (
          <EmptyState message="You haven't sent any requests." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {sent.map((r) => (
              <UserCard
                key={r.requestId}
                person={{ ...r.user, status: "request_sent" }}
                onStatusChange={(status) => status === "none" && removeSent(r.requestId)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-display font-bold text-lg text-ink dark:text-ink-inverted mb-3">
          People You May Know
        </h2>
        {suggestions === null ? (
          <SectionSkeleton />
        ) : suggestions.length === 0 ? (
          <EmptyState message="No suggestions right now." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {suggestions.map((s) => (
              <UserCard key={s.id} person={s} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display font-bold text-lg text-ink dark:text-ink-inverted mb-3">
          My Friends {friends?.length > 0 && `(${friends.length})`}
        </h2>
        {friends === null ? (
          <SectionSkeleton />
        ) : friends.length === 0 ? (
          <EmptyState message="You haven't added any friends yet." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {friends.map((f) => (
              <UserCard
                key={f.id}
                person={{ ...f, status: "friends" }}
                onStatusChange={(status) =>
                  status === "none" && setFriends((list) => list.filter((x) => x.id !== f.id))
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4">
          <SkeletonUserRow />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="card flex flex-col items-center text-center py-10 px-6">
      <span className="w-11 h-11 rounded-xl bg-surface-light dark:bg-white/5 text-ink-muted flex items-center justify-center mb-3">
        <UserX size={18} />
      </span>
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}
