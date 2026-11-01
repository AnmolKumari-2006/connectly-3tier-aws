import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";

const ToastContext = createContext(null);

let idCounter = 0;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, variant = "success") => {
      setToasts((list) => {
        // Same message already showing? Don't pile up duplicates (this is
        // what was burying the Trending Topics panel when the same "UI
        // preview only" toast fired repeatedly) — just keep the existing one.
        if (list.some((t) => t.message === message)) return list;
        const id = ++idCounter;
        const next = [...list, { id, message, variant }];
        // Cap how many can stack up at once.
        return next.slice(-MAX_VISIBLE);
      });
      setTimeout(() => {
        setToasts((list) => list.filter((t) => t.message !== message));
      }, 3400);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Bottom-center, not bottom-right — the right sidebar (search,
          friend requests, trending topics) lives at the right edge on
          desktop, and a right-anchored toast stack was covering it. */}
      <div className="fixed bottom-20 md:bottom-6 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="pointer-events-auto flex items-center gap-2.5 w-full max-w-xs rounded-xl2 bg-surface-card dark:bg-surface-dark-card
                         border border-border dark:border-border-dark shadow-soft-hover dark:shadow-soft-dark-hover
                         px-4 py-3 text-sm text-ink dark:text-ink-inverted"
            >
              {t.variant === "success" && <CheckCircle2 size={18} className="text-accent shrink-0" />}
              {t.variant === "info" && <Info size={18} className="text-primary shrink-0" />}
              {t.variant === "warning" && <AlertTriangle size={18} className="text-amber-500 shrink-0" />}
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="text-ink-muted hover:text-ink dark:hover:text-ink-inverted"
              >
                <X size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
