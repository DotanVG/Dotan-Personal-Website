"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { site } from "@/content/site";
import { ageFromDob } from "@/lib/age";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { useIsMobile } from "@/lib/useIsMobile";

export function About() {
  const age = ageFromDob(site.dob);
  return (
    <section
      id="about"
      className="relative mx-auto w-full max-w-page scroll-mt-24 px-6 py-32 md:px-8 md:py-48"
    >
      <RevealOnScroll>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
          About
        </p>
      </RevealOnScroll>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-7">
          <RevealOnScroll>
            <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
              I build software the way I make games:{"\ "}
              <span className="text-ink/40 transition-colors duration-700 hover:text-ink">
                curious, deliberate, playful.
              </span>
            </h2>
          </RevealOnScroll>

          {site.bio.map((p, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-12%" }}
              transition={{
                delay: 0.1 + i * 0.12,
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-8 max-w-prose text-pretty text-lg leading-relaxed text-ink/80"
            >
              {p}
            </motion.p>
          ))}

          <RevealOnScroll delay={0.3}>
            <dl className="mt-12 grid grid-cols-1 gap-x-10 gap-y-1 border-t border-line pt-8 sm:grid-cols-2">
              <Row label="Age" value={`${age}`} />
              <Row label="Location" value={site.location} />
              <Row
                label="Email"
                value={
                  <a
                    href={`mailto:${site.email}`}
                    className="hover:text-ink hover:underline"
                  >
                    {site.email}
                  </a>
                }
              />
              <Row
                label="Currently"
                value={
                  <>
                    Integration QA at{"\ "}
                    <a
                      href="https://zota.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      Zota
                    </a>{"\ "}
                    , since Jan 2025
                  </>
                }
              />
            </dl>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delay={0.15} className="md:col-span-5">
          <AvatarTilt />
        </RevealOnScroll>
      </div>
    </section>
  );
}

function AvatarTilt() {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 200, damping: 18, mass: 0.5 });
  const rotateX = useTransform(sy, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-12, 12]);
  const glareX = useTransform(sx, [-0.5, 0.5], ["20%", "80%"]);
  const glareY = useTransform(sy, [-0.5, 0.5], ["20%", "80%"]);
  const glareBg = useTransform(
    [glareX, glareY],
    ([gx, gy]: string[]) =>
      `radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.18), transparent 55%)`,
  );

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isMobile) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      whileHover={{ scale: isMobile ? 1 : 1.015 }}
      className="relative aspect-square w-full max-w-[420px]"
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl border border-line bg-canvas-raised">
        <Image
          src="/images/avatar.jpg"
          alt={`${site.fullName} portrait`}
          fill
          priority
          sizes="(min-width: 768px) 420px, 80vw"
          className="object-cover transition-transform duration-700 hover:scale-[1.04]"
        />
        <motion.div
          aria-hidden
          style={{ background: glareBg }}
          className="pointer-events-none absolute inset-0 mix-blend-overlay"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 60% at 50% 100%, rgb(var(--canvas) / 0.55) 0%, transparent 60%)",
          }}
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 rounded-[28px] opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background:
            "conic-gradient(from 220deg, rgb(var(--accent-glow) / 0.6), rgb(var(--ink) / 0.05), rgb(var(--accent-glow) / 0.6))",
        }}
      />
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="group flex flex-col gap-1 border-b border-line/60 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-24 shrink-0 font-mono text-xs uppercase tracking-[0.18em] text-ink/50 transition-colors duration-300 group-hover:text-ink/80">
        {label}
      </dt>
      <dd className="text-sm text-ink/80 transition-colors duration-300 group-hover:text-ink md:text-base">
        {value}
      </dd>
    </div>
  );
}
