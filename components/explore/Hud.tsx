"use client";

import type { RefObject } from "react";
import { cn } from "@/lib/cn";
import type { HudView } from "./uiStore";

export type HudRefs = {
  speed: RefObject<HTMLSpanElement | null>;
  condBar: RefObject<HTMLDivElement | null>;
  condText: RefObject<HTMLSpanElement | null>;
};

const pill =
  "pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-[#1d222b]/70 px-4 text-sm font-medium text-white shadow-md backdrop-blur-sm transition-colors hover:bg-[#1d222b]/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#facc15]";

export function Hud({
  hud,
  touch,
  refs,
  toast,
  coach,
  onPause,
  onClean,
  onContact,
  onDismissCoach,
}: {
  hud: HudView;
  touch: boolean;
  refs: HudRefs;
  toast: string | null;
  coach: boolean;
  onPause: () => void;
  onClean: () => void;
  onContact: () => void;
  onDismissCoach: () => void;
}) {
  const driving = hud.state === "driving";
  const prompt = keyPrompt(hud);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 font-sans">
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-[max(12px,env(safe-area-inset-left))] pt-[max(10px,env(safe-area-inset-top))]">
        <button type="button" onClick={onClean} className={pill}>
          <span aria-hidden>←</span>
          <span>
            Clean<span className="max-[359px]:hidden"> view</span>
          </span>
        </button>
        <div className="flex items-center gap-2 pr-[max(0px,calc(env(safe-area-inset-right)-12px))]">
          <button type="button" onClick={onContact} className={pill}>
            Contact
          </button>
          <button
            type="button"
            onClick={onPause}
            // A second finger (the first is on a pedal) never gets a click event; pause anyway.
            onPointerUp={(e) => {
              if (!e.isPrimary) onPause();
            }}
            className={cn(pill, "px-3.5")}
            aria-label="Pause, controls and settings"
            data-testid="pause-button"
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect x="3" y="3" width="4" height="12" rx="1.2" />
              <rect x="11" y="3" width="4" height="12" rx="1.2" />
            </svg>
            <span className="max-[419px]:sr-only">Menu</span>
          </button>
        </div>
      </div>

      {/* Speed, condition, and messages stack in one column so they never overlap. */}
      <div className="absolute inset-x-0 top-[calc(max(10px,env(safe-area-inset-top))+56px)] flex flex-col items-center gap-2 px-3 [@media(max-height:500px)]:top-[max(10px,env(safe-area-inset-top))]">
        {driving && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-[#1d222b]/70 px-4 py-2 text-white shadow-md backdrop-blur-sm" data-testid="speedo">
            <div className="flex items-baseline gap-1">
              <span ref={refs.speed} className="min-w-[2.2ch] text-right font-display text-3xl font-semibold tabular-nums leading-none">
                0
              </span>
              <span className="text-xs font-medium text-white/75">km/h</span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-wider text-white/80">
                <span>{hud.vehicle ?? "Car"}</span>
                <span ref={refs.condText} className="tabular-nums">
                  100%
                </span>
              </div>
              <div className="h-2 w-28 overflow-hidden rounded-full bg-white/20" aria-hidden>
                <div ref={refs.condBar} className="h-full w-full rounded-full bg-[#8fd18a] transition-[width] duration-200" />
              </div>
            </div>
          </div>
        )}
        {driving && hud.wrecked && (
          <div className="rounded-full bg-[#b3402c]/90 px-4 py-1.5 text-center text-sm font-semibold text-white shadow">
            Wrecked, {touch ? "tap Get out" : "press E to get out"}
          </div>
        )}
        {toast && (
          <div role="status" className="max-w-sm rounded-full bg-[#1d222b]/80 px-4 py-2 text-center text-sm font-medium text-white shadow-md backdrop-blur-sm">
            {toast}
          </div>
        )}
        {driving && hud.nearLandmark && !toast && (
          <div className="rounded-full border border-[#f2cf7e]/50 bg-[#1d222b]/65 px-3.5 py-1.5 text-xs font-medium text-[#fbe7b5] shadow backdrop-blur-sm">
            {hud.nearLandmark} nearby · stop and step out to read
          </div>
        )}
      </div>

      {/* Keyboard context prompt */}
      {!touch && prompt && (
        <div className="absolute inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] flex justify-center">
          <div className="flex items-center gap-2.5 rounded-full border border-white/25 bg-[#1d222b]/75 py-1.5 pl-1.5 pr-4 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
            <kbd className="grid size-8 place-items-center rounded-full bg-white font-sans text-sm font-bold text-[#1d222b]">{prompt.key}</kbd>
            {prompt.text}
          </div>
        </div>
      )}

      {coach && <Coach touch={touch} onDismiss={onDismissCoach} />}
    </div>
  );
}

function keyPrompt(h: HudView): { key: string; text: string } | null {
  if (h.state === "onFoot" && (h.context === "enter" || h.context === "inspect")) return { key: "E", text: h.contextLabel };
  if (h.state === "driving") {
    if (h.suggestUnstuck) return { key: "R", text: "Unstuck" };
    if (h.wrecked) return null;
    if (h.context === "exit") return { key: "E", text: "Get out" };
  }
  return null;
}

function Coach({ touch, onDismiss }: { touch: boolean; onDismiss: () => void }) {
  return (
    <div className="absolute inset-x-0 top-[calc(max(10px,env(safe-area-inset-top))+62px)] flex justify-center px-3 [@media(max-height:500px)]:top-[max(10px,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-white/20 bg-[#1d222b]/85 p-3.5 text-white shadow-xl backdrop-blur-sm">
        <div className="text-sm leading-relaxed">
          <p className="font-semibold">Grab a car and go.</p>
          <p className="mt-0.5 text-white/85">
            {touch
              ? "Left thumb moves or steers. Walk up to a car and tap Enter. Drag the scenery to look around."
              : "WASD to move and drive, E to get in or out, Space to jump or handbrake, drag to look."}{" "}
            Glowing pads by the buildings open Dotan&apos;s story.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-[#1d222b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#facc15]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
