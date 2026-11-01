import { Link } from "react-router-dom";
import { useState } from "react";
import Avatar from "../ui/Avatar";
import FriendActionButton from "./FriendActionButton";
import { mediaUrl } from "../../api/client";

// Compact vertical card used in Explore's people grid and suggestions.
// `person` is a serialized user from the API, already carrying `status`
// and (when relevant) a `mutual` friend count.
export default function UserCard({ person, onStatusChange }) {
  const [status, setStatus] = useState(person.status);
  if (!person) return null;

  const handleChange = (newStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  };

  return (
    <div className="card card-hover p-4 flex flex-col items-center text-center">
      <Link to={`/profile/${person.username}`}>
        <Avatar src={mediaUrl(person.avatar)} alt={person.fullName} size="lg" />
      </Link>
      <Link
        to={`/profile/${person.username}`}
        className="mt-3 font-semibold text-sm text-ink dark:text-ink-inverted hover:text-primary dark:hover:text-accent"
      >
        {person.fullName}
      </Link>
      <p className="text-xs text-ink-muted mb-1">@{person.username}</p>
      {person.mutual !== undefined && (
        <p className="text-[11px] text-ink-muted mb-3">{person.mutual} mutual friends</p>
      )}
      <FriendActionButton
        userId={person.id}
        status={status}
        onStatusChange={handleChange}
        className="w-full mt-1"
      />
    </div>
  );
}
