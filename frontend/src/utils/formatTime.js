// The backend stores timestamps in UTC as "YYYY-MM-DD HH:MM:SS(.mmm)" with
// no timezone marker. `new Date("2026-09-26 08:00:00")` treats that as LOCAL
// time, so for anyone not on UTC everything is shifted by their offset — in
// Karachi (UTC+5) a comment written a moment ago showed up as "5h". Parse
// them explicitly as UTC so they're converted to the viewer's real local time.
export function parseServerDate(value) {
  if (value instanceof Date) return value;
  if (!value) return new Date(NaN);
  let text = String(value).trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (!hasTimezone) text = text.replace(" ", "T") + "Z";
  return new Date(text);
}

// "just now" · "5m" · "3h" · "2d" · "1w" · "Sep 12"
export function formatRelativeTime(value) {
  const then = parseServerDate(value).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.floor(Math.max(0, Date.now() - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w`;

  return parseServerDate(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Full exact local date + time — used for hover tooltips.
export function formatFullDate(value) {
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const clock = { hour: "numeric", minute: "2-digit" };

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Chat bubbles show the real clock time: "3:42 PM" today, "Sep 25, 3:42 PM" earlier.
export function formatClockTime(value) {
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(undefined, clock);
  if (isSameDay(date, new Date())) return time;
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

// Conversation list: clock time today, "Yesterday", weekday this week, else date.
export function formatListTime(value) {
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (isSameDay(date, now)) return date.toLocaleTimeString(undefined, clock);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";
  const daysAgo = (now - date) / 86400000;
  if (daysAgo < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
