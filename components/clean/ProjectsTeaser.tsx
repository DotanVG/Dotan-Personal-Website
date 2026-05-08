import { projects } from "@/content/projects";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

export function ProjectsTeaser() {
  if (projects.length > 0) {
    return null;
  }

  return (
    <section
      id="projects"
      className="relative mx-auto w-full max-w-page scroll-mt-24 px-6 py-32 md:px-8 md:py-48"
    >
      <RevealOnScroll>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
          04 — Indie Games
        </p>
        <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          The game studio is{" "}
          <span className="text-ink/40">under construction.</span>
        </h2>
        <p className="mt-6 max-w-prose text-lg text-ink/70">
          By day I ship payment integrations. By night I&apos;m building small
          worlds. The first playable demo is on its way — drop me a line and
          I&apos;ll send you a key when it&apos;s ready.
        </p>
      </RevealOnScroll>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-16 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <RevealOnScroll key={i} delay={i * 0.08}>
            <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-dashed border-line bg-canvas-raised/40">
              <div
                aria-hidden
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgb(var(--accent-glow) / 0.2), transparent 60%)",
                }}
              />
              <div className="absolute inset-0 grain" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
                  Project · 0{i}
                </div>
                <div className="font-display text-xl text-ink/70">
                  Coming soon
                </div>
              </div>
            </div>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}
