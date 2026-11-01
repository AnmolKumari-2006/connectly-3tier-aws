import { cn } from "../../utils/cn";
import { getAvatarFallback } from "../../utils/avatarFallback";

const SIZES = {
  xs: "w-7 h-7",
  sm: "w-9 h-9",
  md: "w-11 h-11",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
  "2xl": "w-32 h-32",
};

const DOT_SIZES = {
  xs: "w-1.5 h-1.5",
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
  xl: "w-4 h-4",
  "2xl": "w-5 h-5",
};

export default function Avatar({ src, alt, size = "md", online, ring, className }) {
  // No uploaded photo yet (a brand-new account defaults to an empty
  // avatar) → show a colorful initials placeholder instead of a broken
  // image icon. Also falls back if a given URL fails to load at runtime.
  const fallback = getAvatarFallback(alt);

  return (
    <span className={cn("relative inline-block shrink-0", SIZES[size], className)}>
      <img
        src={src || fallback}
        alt={alt}
        loading="lazy"
        onError={(e) => {
          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
        }}
        className={cn(
          "w-full h-full rounded-full object-cover bg-surface-light dark:bg-white/10",
          ring && "ring-2 ring-surface-card dark:ring-surface-dark-card"
        )}
      />
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-surface-card dark:border-surface-dark-card",
            DOT_SIZES[size],
            online ? "bg-accent" : "bg-ink-muted/50"
          )}
          aria-label={online ? "Online" : "Offline"}
        />
      )}
    </span>
  );
}
