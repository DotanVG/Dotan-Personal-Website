"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";

export function ExplorePlaceholder() {
  const setMode = useApp((s) => s.setMode);

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-canvas-inset px-6 py-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 30%, rgb(var(--accent-glow) / 0.18) 0%, transparent 60%), radial-gradient(60% 60% at 50% 90%, rgb(var(--ink) / 0.1) 0%, transparent 60%)",
        }}
      />
      <div className="absolute inset-0 grain -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink/60">
          Explore mode · Beta
        </p>
        <h2 className="mt-6 font-display text-5xl font-semibold tracking-tight text-balance md:text-7xl">
          A world is being built.
        </h2>
        <p className="mt-6 text-pretty text-lg text-ink/70">
          A walkable 3D map of every chapter of my career — Naval School,
          Electra, Kanomi, Ness, Zota and the rest — is on the way. Drag, walk,
          and read the signs.
        </p>
        <p className="mt-2 text-sm text-ink/50">
          Until then, the Clean view has the whole story.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setMode("clean");
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.delete("mode");
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-canvas hover:-translate-y-0.5"
          >
            ← Back to Clean view
          </button>
          <Link
            href="https://github.com/DotanVG"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline"
          >
            Watch progress on GitHub →
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
          {["Naval", "ORT", "Electra", "HackerU", "Kanomi", "Nitzanim", "Ness", "Zota"].map(
            (m, i) => (
              <motion.div
                key={m}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-xl border border-line bg-canvas-raised/40 px-3 py-2 text-xs text-ink/70"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
                  Pin · 0{i + 1}
                </span>
                <div className="mt-1 font-display text-base">{m}</div>
              </motion.div>
            ),
          )}
        </div>
      </motion.div>
    </div>
  );
}
