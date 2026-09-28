"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { LoadingScreen } from "@/components/explore/LoadingScreen";

const ExploreScene = dynamic(() => import("@/components/explore/ExploreScene"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

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

  // Enter fades only: an exit animation under AnimatePresence "wait" never completed
  // (nested presence in the clean tree), which stranded in-page mode switches.
  return mode === "clean" ? (
    <motion.div
      key="clean"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {cleanContent}
    </motion.div>
  ) : (
    <motion.div
      key="explore"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <ExploreScene />
    </motion.div>
  );
}
