"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import { ExplorePlaceholder } from "@/components/explore/ExplorePlaceholder";

export function ModeRouter({ cleanContent }: { cleanContent: ReactNode }) {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("mode");
    if (param === "explore") setMode("explore");
    else setMode("clean");
    setHydrated(true);
  }, [setMode]);

  useEffect(() => {
    function onPop() {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("mode");
      setMode(param === "explore" ? "explore" : "clean");
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setMode]);

  if (!hydrated) {
    return <>{cleanContent}</>;
  }

  return (
    <AnimatePresence mode="wait">
      {mode === "clean" ? (
        <motion.div
          key="clean"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {cleanContent}
        </motion.div>
      ) : (
        <motion.div
          key="explore"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <ExplorePlaceholder />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
