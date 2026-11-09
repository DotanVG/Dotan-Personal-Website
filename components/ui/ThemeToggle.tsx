"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mountGlassToggle, type GlassController } from "@/components/ui/glassToggleGl";
import {
  GLASS_CANVAS,
  pointerBecameDrag,
  shouldUseGlassShader,
  themeForThumb,
  thumbForTheme,
  thumbFromPointer,
} from "@/lib/glassToggle";
import { cn } from "@/lib/cn";

function subscribeThemeClass(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function darkOnClient() {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();
  const isDark = useSyncExternalStore(subscribeThemeClass, darkOnClient, () => false);
  const [glOn, setGlOn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const glassRef = useRef<GlassController | null>(null);
  const dragRef = useRef({ active: false, dragging: false, x: 0, y: 0 });
  const suppressClick = useRef(false);
  const writing = useRef(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const button = buttonRef.current;
    const root = button?.parentElement;
    if (!canvas || !root) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let offscreen = false;
    let hidden = document.visibilityState === "hidden";

    function syncSuspend() {
      glassRef.current?.suspend(offscreen || hidden || reducedRef.current);
    }

    function destroyGlass() {
      glassRef.current?.destroy();
      glassRef.current = null;
      if (!disposed) setGlOn(false);
    }

    function ensureGlass() {
      if (disposed || reducedRef.current || glassRef.current) return;
      const initial = thumbForTheme(darkOnClient() ? "dark" : "light");
      const controller = mountGlassToggle(canvas!, initial, () => {
        if (!disposed) destroyGlass();
      });
      if (!controller || !shouldUseGlassShader(reducedRef.current, true)) {
        controller?.destroy();
        return;
      }
      glassRef.current = controller;
      syncSuspend();
      if (!disposed) setGlOn(true);
    }

    function applyMotion() {
      reducedRef.current = motion.matches;
      if (motion.matches) destroyGlass();
      else ensureGlass();
    }

    applyMotion();
    motion.addEventListener("change", applyMotion);

    const seen = new IntersectionObserver(([entry]) => {
      offscreen = !entry?.isIntersecting;
      syncSuspend();
    });
    seen.observe(root);

    function onVisibility() {
      hidden = document.visibilityState === "hidden";
      syncSuspend();
    }
    document.addEventListener("visibilitychange", onVisibility);

    let queued = false;
    const theme = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        const glass = glassRef.current;
        if (!glass || writing.current || dragRef.current.dragging || disposed) return;
        glass.animateTo(thumbForTheme(darkOnClient() ? "dark" : "light"));
      });
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      disposed = true;
      motion.removeEventListener("change", applyMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      seen.disconnect();
      theme.disconnect();
      destroyGlass();
    };
  }, []);

  function commit(theme: "light" | "dark") {
    const root = document.documentElement;
    writing.current = true;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
    writing.current = false;
    setTheme(theme);
  }

  function toggleFromClick() {
    const next = darkOnClient() ? "light" : "dark";
    if (!reducedRef.current) glassRef.current?.animateTo(thumbForTheme(next));
    commit(next);
  }

  return (
    <span className={cn("relative inline-block h-[30px] w-[60px] shrink-0", className)}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2",
          glOn ? "block" : "hidden",
        )}
        style={{ width: GLASS_CANVAS.w, height: GLASS_CANVAS.h }}
      />
      {glOn ? null : <StaticSwitch />}
      <button
        ref={buttonRef}
        type="button"
        role="switch"
        aria-label="Dark mode"
        aria-checked={isDark}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragRef.current = { active: true, dragging: false, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag.active || reducedRef.current || !glassRef.current) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (!drag.dragging && !pointerBecameDrag(dx, dy)) return;
          drag.dragging = true;
          const rect = event.currentTarget.getBoundingClientRect();
          glassRef.current.setThumb(thumbFromPointer(event.clientX, rect.left, rect.width));
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag.active) return;
          drag.active = false;
          if (!drag.dragging || !glassRef.current) return;
          suppressClick.current = true;
          const rect = event.currentTarget.getBoundingClientRect();
          const theme = themeForThumb(thumbFromPointer(event.clientX, rect.left, rect.width));
          glassRef.current.animateTo(thumbForTheme(theme));
          commit(theme);
        }}
        onPointerCancel={() => {
          dragRef.current = { active: false, dragging: false, x: 0, y: 0 };
          suppressClick.current = false;
          glassRef.current?.animateTo(thumbForTheme(darkOnClient() ? "dark" : "light"));
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            dragRef.current.dragging = false;
            return;
          }
          toggleFromClick();
        }}
        className="absolute inset-0 z-10 rounded-full touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink focus-visible:shadow-[0_0_0_2px_rgb(var(--canvas)),0_0_0_4px_rgb(10_10_10)] dark:focus-visible:outline-accent-glow dark:focus-visible:shadow-[0_0_0_2px_rgb(var(--canvas)),0_0_0_4px_rgb(250_204_21)]"
      />
    </span>
  );
}

function StaticSwitch() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-full border border-ink/25 bg-canvas-raised shadow-[inset_0_1px_0_rgb(255_255_255_/_0.45)] dark:border-white/25 dark:bg-[#12141a]"
    >
      <span className="absolute top-[3px] right-[3px] flex size-6 items-center justify-center rounded-full bg-[#fff4e5] text-[#c2410c] shadow-[0_0_12px_rgba(255,140,32,0.9)] dark:right-auto dark:left-[3px] dark:bg-[#243656] dark:text-[#f4f8ff] dark:shadow-[0_0_12px_rgba(90,150,255,0.95)]">
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </span>
    </span>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <circle cx="7" cy="7" r="2.3" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M7 1.2v1.6M7 11.2v1.6M1.2 7h1.6M11.2 7h1.6M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1" />
      </g>
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <path d="M8.2 1.6a4.7 4.7 0 1 0 4.2 6.8 3.8 3.8 0 0 1-4.2-6.8z" />
      <circle cx="11.2" cy="3.1" r="0.7" />
    </svg>
  );
}
