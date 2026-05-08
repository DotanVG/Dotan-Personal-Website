"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Loading...",
  "Setting up the world...",
  "Please wait, it's worth it \u{1F609}",
  "Placing the trees...",
  "Warming up the engine...",
  "Almost there...",
  "Your adventure awaits...",
];

const CHAR_DELAY = 48;
const HOLD_DELAY = 1600;

export function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    const msg = MESSAGES[msgIdx];
    if (charIdx < msg.length) {
      const t = setTimeout(() => {
        setDisplayed(msg.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      }, CHAR_DELAY);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
      setCharIdx(0);
      setDisplayed("");
    }, HOLD_DELAY);
    return () => clearTimeout(t);
  }, [charIdx, msgIdx]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-canvas-inset">
      <div className="flex flex-col items-center gap-6">
        <div className="relative size-12">
          <div
            aria-hidden
            className="absolute inset-0 animate-spin rounded-full border-2 border-line border-t-ink"
            style={{ animationDuration: "1.2s" }}
          />
        </div>
        <div className="h-6 min-w-[220px] text-center font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
          {displayed}
          <span className="animate-pulse text-ink/40">|</span>
        </div>
      </div>
    </div>
  );
}
