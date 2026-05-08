"use client";

import { motion, LayoutGroup } from "framer-motion";
import { useApp } from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export function ModeToggle({ className }: { className?: string }) {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const isExplore = mode === "explore";

  function setTo(next: "clean" | "explore") {
    if (next === mode) return;
    setMode(next);
    trackEvent("mode_toggle", { to: next });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "explore") url.searchParams.set("mode", "explore");
      else url.searchParams.delete("mode");
      window.history.replaceState({}, "", url.toString());
    }
  }

  return (
    <LayoutGroup id="mode-toggle">
      <div
        role="group"
        aria-label="Site mode"
        className={cn(
          "relative inline-flex h-9 items-center gap-1 overflow-hidden rounded-full border border-line bg-canvas-raised/60 p-1 text-xs font-medium backdrop-blur transition-colors hover:border-ink/30",
          className,
        )}
      >
        {(["clean", "explore"] as const).map((opt) => {
          const selected = (opt === "explore") === isExplore;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setTo(opt)}
              aria-pressed={selected}
              className={cn(
                "relative isolate rounded-full px-3 py-1 capitalize transition-colors duration-300",
                selected ? "text-canvas" : "text-ink/65 hover:text-ink",
              )}
            >
              {selected && (
                <motion.span
                  layoutId="mode-toggle-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 -z-10 rounded-full bg-ink"
                />
              )}
              {opt}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
