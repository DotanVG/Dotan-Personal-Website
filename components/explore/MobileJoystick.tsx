"use client";

import { useEffect, useRef, useState } from "react";
import { setExploreAxis, requestJump } from "@/lib/explore";

export function MobileJoystick() {
  const [active, setActive] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const center = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      setExploreAxis(0, 0);
    };
  }, []);

  function start(clientX: number, clientY: number) {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    setActive(true);
    move(clientX, clientY);
  }

  function move(clientX: number, clientY: number) {
    const c = center.current;
    if (!c) return;
    const dx = clientX - c.x;
    const dy = clientY - c.y;
    const max = 44;
    const len = Math.hypot(dx, dy);
    const cx = len > max ? (dx / len) * max : dx;
    const cy = len > max ? (dy / len) * max : dy;
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate(${cx}px, ${cy}px)`;
    }
    setExploreAxis(cx / max, cy / max);
  }

  function end() {
    setActive(false);
    center.current = null;
    if (thumbRef.current) {
      thumbRef.current.style.transform = "translate(0px, 0px)";
    }
    setExploreAxis(0, 0);
  }

  return (
    <>
      <div
        ref={baseRef}
        data-explore-joystick={active ? "active" : ""}
        onTouchStart={(e) => {
          const t = e.touches[0];
          start(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          const t = e.touches[0];
          move(t.clientX, t.clientY);
        }}
        onTouchEnd={end}
        onTouchCancel={end}
        className="pointer-events-auto fixed bottom-6 left-6 z-30 size-32 touch-none rounded-full border border-white/20 bg-black/35 backdrop-blur"
      >
        <div
          ref={thumbRef}
          className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-white/80 shadow-lg transition-[opacity] duration-150"
          style={{ opacity: active ? 1 : 0.7 }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">
          Move
        </div>
      </div>

      <button
        type="button"
        onTouchStart={(e) => {
          e.preventDefault();
          requestJump();
        }}
        onClick={(e) => {
          e.preventDefault();
          requestJump();
        }}
        className="pointer-events-auto fixed bottom-6 right-6 z-30 size-20 rounded-full border border-white/20 bg-black/35 font-mono text-xs uppercase tracking-[0.2em] text-white/85 backdrop-blur active:bg-white/20"
      >
        Jump
      </button>
    </>
  );
}
