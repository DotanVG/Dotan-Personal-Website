"use client";

import { motion, LayoutGroup } from "framer-motion";
import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { INSTANT, SPRING_UI } from "@/lib/motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

const OPTIONS = ["clean", "explore"] as const;

function prefetchExplore() {
  void import("@/components/explore/ExploreScene");
}

export function ModeToggle({ className }: { className?: string }) {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const reduced = useReducedMotion();
  const isExplore = mode === "explore";
  const prefetched = useRef(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (prefetched.current) return;
    if (typeof window === "undefined") return;
    const idle =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
        .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => {
      prefetched.current = true;
      prefetchExplore();
    });
  }, []);

  function setTo(next: "clean" | "explore") {
    if (next === mode) return;
    trackEvent("mode_toggle", { to: next });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "explore") {
        url.searchParams.set("mode", "explore");
        window.location.assign(url.toString());
        return;
      }
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url.toString());
    }
    setMode(next);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !back) return;
    e.preventDefault();
    const next = (index + (forward ? 1 : -1) + OPTIONS.length) % OPTIONS.length;
    buttons.current[next]?.focus();
    setTo(OPTIONS[next]);
  }

  function warm() {
    if (prefetched.current) return;
    prefetched.current = true;
    prefetchExplore();
  }

  return (
    <LayoutGroup id="mode-toggle">
      <div
        role="radiogroup"
        aria-label="Site mode"
        onMouseEnter={warm}
        onTouchStart={warm}
        onFocus={warm}
        className={cn(
          "relative inline-flex h-9 items-center gap-1 rounded-full border border-line bg-canvas-raised/60 p-1 text-xs font-medium backdrop-blur transition-colors hover:border-ink/30",
          className,
        )}
      >
        {OPTIONS.map((opt, i) => {
          const selected = (opt === "explore") === isExplore;
          return (
            <button
              key={opt}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              // Roving tabindex: the group is a single tab stop, arrows move within it.
              tabIndex={selected ? 0 : -1}
              onClick={() => setTo(opt)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative isolate rounded-full px-3 py-1 capitalize transition-colors duration-300",
                selected ? "text-canvas" : "text-ink/65 hover:text-ink",
              )}
            >
              {selected && (
                <motion.span
                  layoutId="mode-toggle-pill"
                  transition={reduced ? INSTANT : SPRING_UI}
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
