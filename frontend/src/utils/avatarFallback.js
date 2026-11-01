// Generates a deterministic, colorful initials avatar as an inline SVG data
// URI — no network request, no broken-image icon. Used whenever a user
// hasn't uploaded a real profile picture yet (a brand-new registration
// defaults to an empty avatar on the backend).
const PALETTE = [
  ["#0F4C81", "#00B8D9"],
  ["#7C3AED", "#00B8D9"],
  ["#DB2777", "#F59E0B"],
  ["#0891B2", "#22C55E"],
  ["#EA580C", "#FACC15"],
  ["#4F46E5", "#EC4899"],
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarFallback(name) {
  const initials = getInitials(name);
  const [from, to] = PALETTE[hashString(name || "?") % PALETTE.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#g)" />
      <text x="50" y="50" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="38"
            font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">
        ${initials}
      </text>
    </svg>
  `.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
