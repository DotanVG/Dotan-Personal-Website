"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { site } from "@/content/site";
import { ageFromDob } from "@/lib/age";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

export function About() {
  const [open, setOpen] = useState(false);
  const age = ageFromDob(site.dob);

  return (
    <section
      id="about"
      className="relative mx-auto w-full max-w-page scroll-mt-24 px-6 py-32 md:px-8 md:py-48"
    >
      <RevealOnScroll>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
          01 — About
        </p>
      </RevealOnScroll>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-7">
          <RevealOnScroll>
            <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
              I build software the way I make games:{" "}
              <span className="text-ink/50">curious, deliberate, playful.</span>
            </h2>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <p className="mt-8 max-w-prose text-pretty text-lg leading-relaxed text-ink/80">
              {site.bio[0]}
            </p>
          </RevealOnScroll>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                {site.bio.slice(1).map((p, i) => (
                  <p
                    key={i}
                    className="mt-6 max-w-prose text-pretty text-lg leading-relaxed text-ink/80"
                  >
                    {p}
                  </p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <RevealOnScroll delay={0.2}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
            >
              {open ? "Show less" : "Read more"}
              <span aria-hidden>{open ? "↑" : "↓"}</span>
            </button>
          </RevealOnScroll>

          <RevealOnScroll delay={0.3}>
            <dl className="mt-12 grid grid-cols-1 gap-x-10 gap-y-4 border-t border-line pt-8 sm:grid-cols-2">
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
                    Integration QA Specialist at{" "}
                    <a
                      href="https://zota.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      Zota
                    </a>{" "}
                    — since Jan 2025
                  </>
                }
              />
            </dl>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delay={0.15} className="md:col-span-5">
          <div className="relative aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl border border-line bg-canvas-raised">
            <Image
              src="/images/avatar.jpg"
              alt={`${site.fullName} portrait`}
              fill
              priority
              sizes="(min-width: 768px) 420px, 80vw"
              className="object-cover"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 60% at 50% 100%, rgb(var(--canvas) / 0.5) 0%, transparent 60%)",
              }}
            />
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-20 shrink-0 font-mono text-xs uppercase tracking-[0.18em] text-ink/50">
        {label}
      </dt>
      <dd className="text-sm text-ink/80 md:text-base">{value}</dd>
    </div>
  );
}
