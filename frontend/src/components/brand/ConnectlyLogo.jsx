import { cn } from "../../utils/cn";

const SIZES = {
  sm: { box: "w-7 h-7", svg: 16, text: "text-base" },
  md: { box: "w-9 h-9", svg: 20, text: "text-xl" },
  lg: { box: "w-14 h-14", svg: 30, text: "text-3xl" },
};

// The abstract mark: three connected nodes, standing in for "network" +
// "people" without borrowing any existing platform's silhouette.
function Mark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="16" cy="18" r="5" fill="#00B8D9" />
      <circle cx="32" cy="18" r="5" fill="#00B8D9" />
      <circle cx="24" cy="33" r="5" fill="#00B8D9" />
      <path
        d="M16 18 L24 33 L32 18"
        stroke="#00B8D9"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export default function ConnectlyLogo({ size = "md", withWordmark = true, className }) {
  const s = SIZES[size] || SIZES.md;
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "shrink-0 rounded-2xl bg-primary flex items-center justify-center",
          s.box
        )}
      >
        <Mark size={s.svg} />
      </div>
      {withWordmark && (
        <span className={cn("font-display font-extrabold tracking-tight text-ink dark:text-ink-inverted", s.text)}>
          Connectly
        </span>
      )}
    </div>
  );
}
