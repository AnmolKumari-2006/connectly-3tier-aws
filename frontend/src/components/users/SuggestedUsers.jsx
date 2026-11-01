import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usersApi, mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";
import FriendActionButton from "./FriendActionButton";
import { SkeletonUserRow } from "../ui/SkeletonLoader";

// Self-fetching "People You May Know" list — used in both the right
// sidebar (compact) and the Friends page (full grid via UserCard instead,
// see Friends.jsx). Removes a person from view as soon as a request is
// sent, cancelled back to "none" keeps them visible again.
export default function SuggestedUsers({ limit }) {
  const [people, setPeople] = useState(null); // null = loading

  useEffect(() => {
    usersApi
      .suggestions()
      .then((data) => setPeople(limit ? data.suggestions.slice(0, limit) : data.suggestions))
      .catch(() => setPeople([]));
  }, [limit]);

  const updateStatus = (userId, status) => {
    setPeople((list) =>
      status === "none" ? list : list.filter((p) => p.id !== userId)
    );
  };

  if (people === null) {
    return (
      <div>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonUserRow key={i} />
        ))}
      </div>
    );
  }

  if (people.length === 0) {
    return <p className="text-sm text-ink-muted py-2">No suggestions right now.</p>;
  }

  return (
    <div className="space-y-1">
      {people.map((person) => (
        <div key={person.id} className="flex items-center gap-3 py-2">
          <Link to={`/profile/${person.username}`}>
            <Avatar src={mediaUrl(person.avatar)} alt={person.fullName} size="sm" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              to={`/profile/${person.username}`}
              className="text-sm font-semibold text-ink dark:text-ink-inverted hover:text-primary dark:hover:text-accent block truncate"
            >
              {person.fullName}
            </Link>
            <p className="text-xs text-ink-muted truncate">{person.mutual} mutual friends</p>
          </div>
          <FriendActionButton
            userId={person.id}
            status={person.status}
            onStatusChange={(status) => updateStatus(person.id, status)}
            size="sm"
          />
        </div>
      ))}
    </div>
  );
}
