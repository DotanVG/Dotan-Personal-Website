"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [open, setOpen] = useState(idx === 0);
  return (
    <li className="relative pl-8 md:pl-16">
      <span
        aria-hidden
        className="absolute left-0 top-2 inline-flex size-3 items-center justify-center rounded-full border border-line bg-canvas md:left-2"
      >
        {item.current && (
          <span className="absolute inline-flex size-3 animate-ping rounded-full bg-emerald-500/60" />
        )}
        <span
          className={`block size-1.5 rounded-full ${
            item.current ? "bg-emerald-500" : "bg-ink/60"
          }`}
        />
      </span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full flex-col gap-1 text-left"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-ink/50">
            {item.start}
            {item.start !== item.end ? ` — ${item.end}` : ""}
            {item.current ? " · Present" : ""}
          </div>
          <span
            aria-hidden
            className="text-ink/40 transition-transform group-hover:text-ink/80 group-aria-expanded:rotate-180"
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          >
            ▾
          </span>
        </div>
        <h3 className="font-display text-2xl font-medium tracking-tight text-balance md:text-3xl">
          {item.title}
        </h3>
        <div className="text-sm text-ink/60 md:text-base">{item.subtitle}</div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-5 flex flex-col gap-5 rounded-2xl border border-line bg-canvas-raised/60 p-5 md:flex-row md:gap-7 md:p-7">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas md:size-24">
                <Image
                  src={item.logo}
                  alt={`${item.subtitle} logo`}
                  fill
                  sizes="96px"
                  className="object-contain p-2"
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
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.4 }}
                      className="flex gap-3"
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
        )}
      </AnimatePresence>
    </li>
  );
}
