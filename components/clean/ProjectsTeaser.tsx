"use client";

import { motion } from "framer-motion";
import { projects } from "@/content/projects";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

export function ProjectsTeaser() {
  if (projects.length > 0) return null;

  return (
    <section
      id="projects"
      className="relative mx-auto w-full max-w-page scroll-mt-24 px-6 py-32 md:px-8 md:py-48"
    >
      <RevealOnScroll>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
          04 · Indie Games
        </p>
        <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          The game studio is{" "}
          <span className="text-ink/40 transition-colors duration-700 hover:text-ink">
            under construction.
          </span>
        </h2>
        <p className="mt-6 max-w-prose text-lg text-ink/70">
          By day I ship payment integrations. By night I&apos;m building small
          worlds. The first playable demo is on its way, drop me a line and
          I&apos;ll send you a key when it&apos;s ready.
        </p>
      </RevealOnScroll>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-16 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{
              delay: i * 0.1,
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-dashed border-line bg-canvas-raised/40 transition-all duration-500 hover:-translate-y-1 hover:border-solid hover:border-ink/20 hover:shadow-[0_30px_70px_-30px_rgb(0_0_0_/_0.5)]"
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-90"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgb(var(--accent-glow) / 0.25), transparent 65%)",
              }}
            />
            <div className="absolute inset-0 grain" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgb(var(--accent-glow) / 0.18), transparent 50%)",
              }}
            />
            <div className="absolute bottom-4 left-4 right-4 transition-transform duration-500 group-hover:-translate-y-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 transition-colors duration-500 group-hover:text-ink/80">
                Project · 0{i}
              </div>
              <div className="font-display text-xl text-ink/70 transition-colors duration-500 group-hover:text-ink">
                Coming soon
              </div>
              <div className="mt-1 h-px w-0 bg-ink/40 transition-all duration-700 group-hover:w-full" />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
