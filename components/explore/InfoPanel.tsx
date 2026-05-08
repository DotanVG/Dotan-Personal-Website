"use client";

import Image from "next/image";
import type { MarkerData } from "./LocationMarker";

export function InfoPanel({
  marker,
  onClose,
}: {
  marker: MarkerData;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto fixed inset-x-4 bottom-4 z-30 mx-auto max-w-2xl rounded-2xl border border-line bg-canvas-raised/95 p-5 shadow-2xl backdrop-blur md:bottom-8 md:p-6">
      <div className="flex items-start gap-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas md:size-20">
          <Image
            src={marker.logo}
            alt={`${marker.subtitle} logo`}
            fill
            sizes="80px"
            className="object-contain p-2"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
              {marker.start}
              {marker.start !== marker.end ? ` - ${marker.end}` : ""}
              {marker.current ? " · Present" : ""}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="rounded-full border border-line px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/70 hover:bg-canvas hover:text-ink"
            >
              Close (E)
            </button>
          </div>
          <h3 className="mt-1 font-display text-xl font-medium tracking-tight md:text-2xl">
            {marker.title}
          </h3>
          <div className="text-sm text-ink/60 md:text-base">{marker.subtitle}</div>
        </div>
      </div>

      {marker.blurb && (
        <p className="mt-4 text-pretty text-sm leading-relaxed text-ink/80 md:text-base">
          {marker.blurb}
        </p>
      )}

      <ul className="mt-3 flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-1 text-sm text-ink/80 md:max-h-56 md:text-[15px]">
        {marker.bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="text-ink/40">
              ›
            </span>
            <span className="text-pretty">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
