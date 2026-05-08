import { education } from "@/content/education";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { TimelineItem } from "./TimelineItem";

export function EducationTimeline() {
  return (
    <section
      id="education"
      className="relative mx-auto w-full max-w-page scroll-mt-24 px-6 py-32 md:px-8 md:py-48"
    >
      <RevealOnScroll>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
          03 — Education
        </p>
        <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Where I learned to think.
        </h2>
      </RevealOnScroll>

      <div className="mt-16 md:mt-24">
        <ol className="relative ml-2 flex flex-col gap-14 border-l border-line pl-0 md:gap-16">
          {education.map((e, i) => (
            <TimelineItem
              key={e.slug}
              idx={i}
              item={{
                slug: e.slug,
                title: e.degree,
                subtitle: e.school,
                start: e.start,
                end: e.end,
                logo: e.logo,
                blurb: e.blurb,
                bullets: e.bullets,
              }}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
