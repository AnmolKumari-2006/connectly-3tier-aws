import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-surface-light dark:bg-surface-dark">
      <span className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-5">
        <Compass size={28} />
      </span>
      <h1 className="font-display font-extrabold text-3xl text-ink dark:text-ink-inverted mb-2">404</h1>
      <p className="text-sm text-ink-muted mb-6">This page doesn't exist on Connectly.</p>
      <Link to="/" className="btn-primary">
        Back to Home
      </Link>
    </div>
  );
}
