"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/cn";
import { ModeToggle } from "@/components/mode/ModeToggle";

const links = [
  { href: "#about", label: "About" },
  { href: "#experience", label: "Experience" },
  { href: "#education", label: "Education" },
  { href: "#contact", label: "Contact" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = links.map((l) => l.href.slice(1));
    const observers = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-40% 0px -55% 0px" },
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-500",
        scrolled
          ? "border-b border-line/70 bg-canvas/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-page items-center justify-between px-4 md:px-8">
        <Link
          href="#top"
          className="group relative font-display text-base font-semibold tracking-tight"
        >
          <span className="relative z-10">Dotan Veretzky</span>
          <span
            aria-hidden
            className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-ink transition-transform duration-500 group-hover:scale-x-100"
            style={{ transformOrigin: "0% 50%" }}
          />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const isActive = active === l.href.slice(1);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "group relative rounded-full px-3 py-1.5 text-sm transition-colors duration-300",
                  isActive ? "text-ink" : "text-ink/65 hover:text-ink",
                )}
              >
                <span className="relative z-10">{l.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-1 -z-0 rounded-full transition-all duration-500",
                    isActive
                      ? "scale-100 bg-canvas-raised"
                      : "scale-90 opacity-0 group-hover:scale-100 group-hover:bg-canvas-raised group-hover:opacity-100",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute -bottom-0.5 left-1/2 h-px w-6 -translate-x-1/2 bg-ink transition-transform duration-500",
                    isActive ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line transition-colors hover:bg-canvas-raised md:hidden"
          >
            <span aria-hidden className="text-lg leading-none">
              {open ? "×" : "≡"}
            </span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line/70 bg-canvas/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-page flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-ink/80 transition-colors hover:bg-canvas-raised"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
