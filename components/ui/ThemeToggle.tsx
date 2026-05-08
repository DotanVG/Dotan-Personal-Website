"use client";

import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "group relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-line text-ink/80 transition-all duration-300 hover:scale-105 hover:border-ink/30 hover:bg-canvas-raised hover:text-ink",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full rounded-full bg-ink/5 transition-transform duration-500 group-hover:translate-x-0"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          aria-hidden
          key={isDark ? "moon" : "sun"}
          initial={{ y: -12, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 12, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.25 }}
          className="relative text-base"
        >
          {mounted ? (isDark ? "☾" : "☀") : ""}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
