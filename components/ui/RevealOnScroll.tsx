"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { INSTANT, SPRING_UI } from "@/lib/motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

const variants: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

export function RevealOnScroll({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const MotionTag = motion[as] as typeof motion.div;
  const reduced = useReducedMotion();
  return (
    <MotionTag
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      transition={reduced ? INSTANT : { ...SPRING_UI, delay }}
      className={cn(className)}
    >
      {children}
    </MotionTag>
  );
}
