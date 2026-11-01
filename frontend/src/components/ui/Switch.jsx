import { cn } from "../../utils/cn";

export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-60",
        checked ? "bg-primary dark:bg-accent" : "bg-border dark:bg-border-dark"
      )}
    >
      <span
        className={cn(
          "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
        style={{ height: "1.125rem", width: "1.125rem" }}
      />
    </button>
  );
}
