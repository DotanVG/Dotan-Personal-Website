"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/lib/useIsMobile";

const STORAGE_KEY = "dotanv-explore-hint-seen";

export function Instructions() {
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    setShow(true);
    const id = window.setTimeout(() => {
      setShow(false);
      localStorage.setItem(STORAGE_KEY, "1");
    }, 6000);
    return () => window.clearTimeout(id);
  }, []);

  function dismiss() {
    setShow(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={dismiss}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="pointer-events-auto fixed left-1/2 top-20 z-30 flex max-w-md -translate-x-1/2 flex-col items-center gap-1 rounded-2xl border border-white/15 bg-black/55 px-5 py-3 text-center backdrop-blur"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">
            Welcome to the world
          </span>
          <span className="text-sm text-white/90 md:text-base">
            {isMobile
              ? "Drag the joystick to walk · Tap signs to read · Tap to dismiss"
              : "WASD or arrow keys to walk · Shift to run · Walk onto a glowing pad to read · E to close"}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
