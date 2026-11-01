import { Link } from "react-router-dom";

// Splits text into plain parts, #hashtags and web links.
const TOKEN_RE = /(#[A-Za-z0-9_]{1,50})|(https?:\/\/[^\s]+)/g;

/**
 * Renders user text with clickable #hashtags (open Explore filtered by that
 * tag) and clickable http(s) links. Everything else stays plain text, so no
 * HTML from users is ever rendered.
 */
export default function RichText({ text, className, linkClassName = "text-primary dark:text-accent font-medium hover:underline" }) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const [token, tag, url] = match;
    if (tag) {
      parts.push(
        <Link key={match.index} to={`/explore?tag=${encodeURIComponent(tag.slice(1))}`} className={linkClassName}>
          {tag}
        </Link>
      );
    } else if (url) {
      // Links to this same site open in the app, others in a new tab.
      const sameSite = typeof window !== "undefined" && url.startsWith(window.location.origin);
      parts.push(
        sameSite ? (
          <Link key={match.index} to={url.slice(window.location.origin.length) || "/"} className={linkClassName + " break-all"}>
            {token}
          </Link>
        ) : (
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className={linkClassName + " break-all"}>
            {token}
          </a>
        )
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}
