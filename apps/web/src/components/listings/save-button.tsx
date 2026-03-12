"use client";

import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { isWatched, toggleWatchlist, type WatchItem } from "@/lib/watchlist";
import { cn } from "@/lib/cn";

interface SaveButtonProps {
  item: Omit<WatchItem, "saved_at">;
  className?: string;
}

export function SaveButton({ item, className }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Read localStorage after mount (SSR safe)
  useEffect(() => {
    setSaved(isWatched(item.id));
  }, [item.id]);

  function handleClick() {
    const nowSaved = toggleWatchlist(item);
    setSaved(nowSaved);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
  }

  return (
    <button
      onClick={handleClick}
      aria-label={saved ? "Remove from saved items" : "Save item"}
      title={saved ? "Remove from saved items" : "Save item"}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
        saved
          ? "border-antique-accent bg-antique-accent-s text-antique-accent"
          : "border-antique-border bg-antique-surface text-antique-text-sec hover:border-antique-accent hover:text-antique-accent",
        animating && "scale-95",
        className
      )}
    >
      {saved ? (
        <BookmarkCheck className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Bookmark className="w-4 h-4 flex-shrink-0" />
      )}
      {saved ? "Saved" : "Save item"}
    </button>
  );
}
