import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smile } from "lucide-react";
import { cn } from "../../utils/cn";

const CATEGORIES = [
  {
    name: "Smileys",
    icon: "😊",
    emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","😉","😍","🥰","😘","😋","😎","🤩","🥳","😏","😌","😴","🤔","🫡","😢","😭","😤","😡","🥺","😱","🤗","🙄"],
  },
  {
    name: "Gestures",
    icon: "👍",
    emojis: ["👍","👎","👏","🙌","🙏","🤝","💪","👋","✌️","🤞","👌","🤟","🫶","☝️","👀","🧠"],
  },
  {
    name: "Hearts",
    icon: "❤️",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💖","💗","💕","💯","🔥","✨","⭐","🎉"],
  },
  {
    name: "Things",
    icon: "☕",
    emojis: ["☕","🍕","🍔","🍰","🎂","🎵","🎧","📸","🎬","🚀","💻","📚","🌅","🌸","🌈","🐶","🐱","🏃","⚽","✈️"],
  },
];

/** The little smiley button that opens/closes the panel. */
export function EmojiToggle({ open, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Close emoji picker" : "Add emoji"}
      aria-expanded={open}
      className={cn(
        "w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors",
        open
          ? "bg-accent/15 text-accent"
          : "text-ink-muted hover:bg-surface-light dark:hover:bg-white/5 hover:text-amber-500",
        className
      )}
    >
      <Smile size={19} />
    </button>
  );
}

/**
 * The emoji grid. Rendered inline (in normal layout flow) by the parent
 * rather than as a floating popover, so it can never be clipped by a
 * scrolling/overflow-hidden ancestor like a modal or comment thread.
 */
export function EmojiPanel({ open, onSelect }) {
  const [category, setCategory] = useState(0);
  const active = CATEGORIES[category];

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="overflow-hidden"
        >
          <div className="rounded-xl2 border border-border dark:border-border-dark bg-surface-light dark:bg-white/5 p-2 my-2">
            <div className="flex gap-1 mb-1.5" role="tablist" aria-label="Emoji categories">
              {CATEGORIES.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  role="tab"
                  aria-selected={i === category}
                  aria-label={c.name}
                  onClick={() => setCategory(i)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors",
                    i === category ? "bg-surface-card dark:bg-white/10 shadow-soft" : "hover:bg-white/60 dark:hover:bg-white/10"
                  )}
                >
                  {c.icon}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-8 gap-0.5 max-h-28 overflow-y-auto">
              {active.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  aria-label={`Insert ${emoji}`}
                  className="h-8 rounded-lg text-xl hover:bg-white dark:hover:bg-white/10 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
