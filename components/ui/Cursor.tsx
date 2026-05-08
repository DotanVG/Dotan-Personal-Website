"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useIsMobile } from "@/lib/useIsMobile";

export function Cursor() {
  const isMobile = useIsMobile();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 600, damping: 40, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 600, damping: 40, mass: 0.3 });
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMobile) return;
    function move(e: MouseEvent) {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = e.target as HTMLElement | null;
      const interactive = !!t?.closest("a, button, [role='button'], [data-cursor='hover']");
      setActive(interactive);
    }
    function leave() {
      x.set(-100);
      y.set(-100);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", leave);
    };
  }, [isMobile, x, y]);

  if (isMobile) return null;

  return (
    <motion.div
      ref={ref}
      aria-hidden
      style={{ x: sx, y: sy }}
      className="pointer-events-none fixed left-0 top-0 z-[100] hidden md:block"
    >
      <motion.div
        animate={{ scale: active ? 2.4 : 1, opacity: active ? 0.6 : 0.85 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-ink mix-blend-difference"
        style={{ width: 16, height: 16 }}
      />
    </motion.div>
  );
}
