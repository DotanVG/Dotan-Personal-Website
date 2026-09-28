"use client";

import Image from "next/image";
import { experience } from "@/content/experience";
import { education } from "@/content/education";
import { Modal } from "./Dialogs";

type Entry = {
  title: string;
  subtitle: string;
  start: string;
  end: string;
  current?: boolean;
  logo: string;
  blurb?: string;
  bullets: string[];
};

/** Portfolio entry for a landmark slug, straight from the site content. */
export function entryFor(slug: string): Entry | null {
  const e = experience.find((x) => x.slug === slug);
  if (e) return { title: e.role, subtitle: e.company, start: e.start, end: e.end, current: e.current, logo: e.logo, blurb: e.blurb, bullets: e.bullets };
  const d = education.find((x) => x.slug === slug);
  if (d) return { title: d.degree, subtitle: d.school, start: d.start, end: d.end, logo: d.logo, blurb: d.blurb, bullets: d.bullets };
  return null;
}

export function InfoPanel({ slug, open, onClose }: { slug: string | null; open: boolean; onClose: () => void }) {
  const entry = slug ? entryFor(slug) : null;
  return (
    <Modal open={open && !!entry} onClose={onClose} labelledBy="info-title">
      {entry && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-[#1d222b]/10 bg-white sm:size-16">
              <Image src={entry.logo} alt={`${entry.subtitle} logo`} fill sizes="64px" className="object-contain p-1.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#b3402c]">
                {entry.start}
                {entry.start !== entry.end ? ` – ${entry.end}` : ""}
              </div>
              <h2 id="info-title" className="mt-0.5 font-display text-xl font-semibold leading-tight sm:text-2xl">
                {entry.title}
              </h2>
              <div className="text-[15px] text-[#1d222b]/70">{entry.subtitle}</div>
            </div>
          </div>
          {entry.blurb && <p className="mt-4 text-pretty text-[15px] leading-relaxed text-[#1d222b]/85">{entry.blurb}</p>}
          <ul className="mt-3 flex flex-col gap-1.5 text-[15px] text-[#1d222b]/85">
            {entry.bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-[#b3402c]">
                  ›
                </span>
                <span className="text-pretty">{b}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1d222b] px-4 text-[15px] font-semibold text-white hover:bg-[#2c333f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b3402c]"
          >
            Back to the city
          </button>
        </div>
      )}
    </Modal>
  );
}
