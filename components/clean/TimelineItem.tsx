"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

export type TimelineRecord = {
  slug: string;
  title: string;
  subtitle: string;
  start: string;
  end: string;
  current?: boolean;
  logo: string;
  blurb?: string;
  bullets: string[];
};

export function TimelineItem({ item, idx }: { item: TimelineRecord; idx: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{
        duration: 0.65,
        delay: reduce ? 0 : Math.min(0.05 * idx, 0.2),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group relative pl-8 md:pl-16"
    >
      <span
        aria-hidden
        className="absolute left-0 top-2 inline-flex size-3 items-center justify-center rounded-full border border-line bg-canvas md:left-2"
      >
        {item.current && (
          <span className="absolute inline-flex size-3 animate-ping rounded-full bg-emerald-500/60" />
        )}
        <span
          className={cn(
            "block size-1.5 rounded-full transition-all duration-500",
            item.current
              ? "bg-emerald-500"
              : "bg-ink/40 group-hover:scale-150 group-hover:bg-ink",
          )}
        />
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute -left-px top-2 block h-[calc(100%+3.5rem)] w-px origin-top scale-y-0 bg-gradient-to-b from-ink/40 to-transparent transition-transform duration-700 group-hover:scale-y-100 md:left-[7px]"
      />

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-ink/50 transition-colors duration-300 group-hover:text-ink/80">
            {item.start}
            {item.start !== item.end ? ` - ${item.end}` : ""}
            {item.current ? " · Present" : ""}
          </div>
        </div>

        <motion.h3
          initial={{ x: -6 }}
          whileInView={{ x: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-2xl font-medium tracking-tight text-balance transition-[letter-spacing] duration-500 group-hover:tracking-[-0.018em] md:text-3xl"
        >
          {item.title}
        </motion.h3>

        <div className="text-sm text-ink/60 md:text-base">{item.subtitle}</div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{
          duration: 0.7,
          delay: reduce ? 0 : 0.15,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="mt-5 overflow-hidden"
      >
        <div className="relative flex flex-col gap-5 rounded-2xl border border-line bg-canvas-raised/60 p-5 transition-all duration-500 hover:-translate-y-0.5 hover:border-ink/20 hover:bg-canvas-raised hover:shadow-[0_24px_60px_-30px_rgb(0_0_0_/_0.45)] md:flex-row md:gap-7 md:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-ink/40 to-transparent transition-transform duration-700 group-hover:scale-x-100"
          />

          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas md:size-24">
            <Image
              src={item.logo}
              alt={`${item.subtitle} logo`}
              fill
              sizes="96px"
              className="object-contain p-2 transition-transform duration-500 will-change-transform group-hover:scale-[1.06]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 mix-blend-overlay transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(70% 60% at 50% 30%, rgb(var(--accent-glow) / 0.35), transparent 70%)",
              }}
            />
          </div>

          <div className="flex-1">
            {item.blurb && (
              <p className="mb-3 text-pretty text-base leading-relaxed text-ink/80">
                {item.blurb}
              </p>
            )}
            <ul className="flex flex-col gap-2 text-sm text-ink/80 md:text-base">
              {item.bullets.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-10%" }}
                  transition={{
                    delay: reduce ? 0 : 0.05 * i,
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="flex gap-3 transition-colors duration-300 hover:text-ink"
                >
                  <span aria-hidden className="text-ink/40">
                    ›
                  </span>
                  <span className="text-pretty">{b}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}
