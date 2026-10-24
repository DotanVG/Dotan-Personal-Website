"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

const WAKE_EVENTS = ["pointermove", "pointerdown", "wheel", "scroll", "keydown"] as const;
// Decorative only: three.js, the HDR and the transmission shader stay off the
// load/hydration path until the visitor interacts (or this fallback elapses).
const WAKE_FALLBACK_MS = 5000;

export function BlobBackdrop() {
  const reduced = useReducedMotion();
  const [desktop, setDesktop] = useState(false);
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduced || !desktop || awake) return;
    const wake = () => setAwake(true);
    const timer = window.setTimeout(wake, WAKE_FALLBACK_MS);
    WAKE_EVENTS.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      WAKE_EVENTS.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [reduced, desktop, awake]);

  if (reduced || !desktop || !awake) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-65 dark:opacity-75"
    >
      <HeroCanvas />
    </div>
  );
}
