"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { site } from "@/content/site";
import { Button } from "@/components/ui/Button";

export function Hero() {
  const [roleIdx, setRoleIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setRoleIdx((i) => (i + 1) % site.roles.length),
      2800,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <section
      id="top"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 75% 30%, rgb(var(--accent-glow) / 0.18) 0%, transparent 60%), radial-gradient(50% 40% at 20% 80%, rgb(var(--ink) / 0.12) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -z-10 h-px top-24 bg-gradient-to-r from-transparent via-line to-transparent"
      />

      <div className="mx-auto grid w-full max-w-page grid-cols-1 gap-12 px-6 md:grid-cols-12 md:gap-16 md:px-8">
        <div className="md:col-span-8">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ink/60"
          >
            Hello — I’m
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05 }}
            className="hero-headline font-display text-[clamp(3rem,11vw,9rem)] font-semibold text-balance"
          >
            Dotan
            <br />
            <span className="marker-underline">Veretzky.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 flex h-9 items-center gap-3 text-lg text-ink/80 md:text-xl"
          >
            <span className="inline-block size-2 rounded-full bg-emerald-500/80 shadow-[0_0_12px] shadow-emerald-500/60" />
            <div className="relative h-7 overflow-hidden">
              {site.roles.map((r, i) => (
                <motion.span
                  key={r}
                  className="block font-display"
                  animate={{
                    y: i === roleIdx ? 0 : i < roleIdx ? -28 : 28,
                    opacity: i === roleIdx ? 1 : 0,
                  }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ position: i === 0 ? "relative" : "absolute", top: 0 }}
                >
                  {r}
                </motion.span>
              ))}
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-8 max-w-xl text-pretty text-base text-ink/70 md:text-lg"
          >
            A portfolio you can read — or walk through. Toggle to{" "}
            <strong className="font-semibold text-ink">Explore</strong> mode and
            wander through every chapter of my career as a small 3D world.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Button href="#contact">Let&apos;s get in touch →</Button>
            <Button href="#experience" variant="outline">
              See my work
            </Button>
            <Link
              href="?mode=explore"
              className="ml-2 text-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline"
            >
              Or enter Explore mode →
            </Link>
          </motion.div>
        </div>

        <div className="relative hidden md:col-span-4 md:block">
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="absolute right-0 top-1/2 size-[min(28rem,32vw)] -translate-y-1/2 rounded-full"
            style={{
              background:
                "conic-gradient(from 220deg at 50% 50%, rgb(var(--accent-glow) / 0.6), rgb(var(--ink) / 0.05), rgb(var(--accent-glow) / 0.6))",
              filter: "blur(40px)",
              animation: "pulseSlow 6s ease-in-out infinite",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative ml-auto size-[min(22rem,26vw)] rounded-full border border-line bg-canvas-raised/40 backdrop-blur"
          >
            <div className="absolute inset-3 rounded-full border border-line" />
            <div className="absolute inset-6 rounded-full border border-line/50" />
            <div
              className="absolute inset-1/4 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgb(var(--accent-glow)) 0%, transparent 60%)",
              }}
            />
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute inset-x-0 bottom-6 flex justify-center"
      >
        <div className="flex flex-col items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink/50">
          <span>Scroll</span>
          <div className="h-8 w-px bg-line" />
        </div>
      </motion.div>
    </section>
  );
}
