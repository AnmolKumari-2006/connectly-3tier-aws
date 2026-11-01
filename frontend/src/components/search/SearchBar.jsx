import { useState } from "react";
import { Search } from "lucide-react";
import SearchOverlay from "./SearchOverlay";

export default function SearchBar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className="input flex items-center gap-2.5 text-ink-muted !cursor-text text-left"
      >
        <Search size={16} />
        <span className="text-sm">Search Connectly…</span>
      </button>
      <SearchOverlay variant="dropdown" open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
