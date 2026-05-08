"use client";

import { useApp } from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export function ModeToggle({ className }: { className?: string }) {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const isExplore = mode === "explore";

  const toggle = () => {
    const next = isExplore ? "clean" : "explore";
    setMode(next);
    trackEvent("mode_toggle", { to: next });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "explore") url.searchParams.set("mode", "explore");
      else url.searchParams.delete("mode");
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isExplore}
      className={cn(
        "relative inline-flex h-9 items-center gap-1 rounded-full border border-line bg-canvas-raised/60 p-1 text-xs font-medium",
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full px-3 py-1 transition-colors",
          !isExplore ? "bg-ink text-canvas" : "text-ink/70",
        )}
      >
        Clean
      </span>
      <span
        className={cn(
          "rounded-full px-3 py-1 transition-colors",
          isExplore ? "bg-ink text-canvas" : "text-ink/70",
        )}
      >
        Explore
      </span>
    </button>
  );
}
