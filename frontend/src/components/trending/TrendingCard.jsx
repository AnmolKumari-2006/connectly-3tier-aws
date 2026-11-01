import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, CalendarHeart, PartyPopper } from "lucide-react";
import { postsApi, usersApi, mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";

/** Most used #hashtags in public posts over the last 30 days (from the database). */
export function TrendingTopics() {
  const [hashtags, setHashtags] = useState(null);

  useEffect(() => {
    postsApi
      .trending()
      .then((d) => setHashtags(d?.hashtags || []))
      .catch(() => setHashtags([]));
  }, []);

  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-2 font-display font-bold text-sm text-ink dark:text-ink-inverted mb-3">
        <TrendingUp size={16} className="text-accent" />
        Trending Topics
      </h3>
      {hashtags === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-8 w-full" />
          ))}
        </div>
      ) : hashtags.length === 0 ? (
        <p className="text-xs text-ink-muted">
          No trending topics yet. Add a #hashtag to a public post to start one.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {hashtags.map((t) => (
            <li key={t.tag}>
              <Link to={`/explore?tag=${encodeURIComponent(t.tag)}`} className="group block">
                <p className="text-sm font-semibold text-ink dark:text-ink-inverted group-hover:text-primary dark:group-hover:text-accent transition-colors">
                  #{t.tag}
                </p>
                <p className="text-xs text-ink-muted">
                  {t.posts} {t.posts === 1 ? "post" : "posts"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function whenLabel(daysAway) {
  if (daysAway === 0) return "Today 🎉";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

function formatDay(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Friends' birthdays in the next 30 days (birthdays are set in Settings > Account). */
export function UpcomingEvents() {
  const [birthdays, setBirthdays] = useState(null);

  useEffect(() => {
    usersApi
      .birthdays()
      .then((d) => setBirthdays(d?.birthdays || []))
      .catch(() => setBirthdays([]));
  }, []);

  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-2 font-display font-bold text-sm text-ink dark:text-ink-inverted mb-3">
        <CalendarHeart size={16} className="text-accent" />
        Upcoming birthdays
      </h3>
      {birthdays === null ? (
        <div className="skeleton h-10 w-full" />
      ) : birthdays.length === 0 ? (
        <p className="text-xs text-ink-muted">No friends' birthdays in the next 30 days.</p>
      ) : (
        <ul className="space-y-3">
          {birthdays.slice(0, 4).map((b) => (
            <li key={b.user.id}>
              <Link to={`/profile/${b.user.username}`} className="flex items-center gap-3 group">
                <span className="relative shrink-0">
                  <Avatar src={mediaUrl(b.user.avatar)} alt={b.user.fullName} size="sm" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent text-[#04222c] flex items-center justify-center">
                    <PartyPopper size={11} />
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink dark:text-ink-inverted truncate group-hover:text-primary dark:group-hover:text-accent">
                    {b.user.fullName} turns {b.turningAge}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDay(b.date)} · {whenLabel(b.daysAway)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
