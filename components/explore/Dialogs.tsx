"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { TouchMode } from "./uiStore";

/** Native modal dialog: focus moves in, Escape/backdrop close, focus returns on close. */
export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      restore.current?.focus?.();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-24px)] w-[min(94vw,560px)] [@media(max-height:500px)_and_(min-width:640px)]:w-[min(94vw,760px)] overflow-y-auto rounded-2xl border border-[#1d222b]/10 bg-[#f7f0e2] p-0 text-[#1d222b] shadow-2xl backdrop:bg-[#1d222b]/55 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      {open && children}
    </dialog>
  );
}

const btn =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b3402c]";
const primary = cn(btn, "bg-[#1d222b] text-white hover:bg-[#2c333f]");
const secondary = cn(btn, "border border-[#1d222b]/20 bg-white/60 text-[#1d222b] hover:bg-white");

export function PauseMenu({
  open,
  view,
  driving,
  touchMode,
  reduced,
  onResume,
  onView,
  onUnstuck,
  onRestart,
  onTouchMode,
  onClean,
  onContact,
}: {
  open: boolean;
  view: "menu" | "help";
  driving: boolean;
  touchMode: TouchMode;
  reduced: boolean;
  onResume: () => void;
  onView: (v: "menu" | "help") => void;
  onUnstuck: () => void;
  onRestart: () => void;
  onTouchMode: (m: TouchMode) => void;
  onClean: () => void;
  onContact: () => void;
}) {
  return (
    <Modal open={open} onClose={onResume} labelledBy="pause-title">
      {view === "help" ? (
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="pause-title" className="font-display text-xl font-semibold">
              Controls
            </h2>
            <button type="button" onClick={() => onView("menu")} className="min-h-11 rounded-full px-4 text-sm font-semibold underline-offset-4 hover:underline">
              Back
            </button>
          </div>
          <HelpContent />
          <button type="button" className={cn(primary, "mt-5")} onClick={onResume} autoFocus>
            Resume
          </button>
        </div>
      ) : (
        <div className="p-5 sm:p-6 [@media(max-height:500px)]:p-4">
          <h2 id="pause-title" className="font-display text-xl font-semibold">
            Paused
          </h2>
          <p className="mt-1 text-sm text-[#1d222b]/70 [@media(max-height:500px)]:hidden">A small city to drive around. The glowing pads by the landmark buildings open Dotan&apos;s work and study history.</p>
          <div className="mt-4 grid gap-2.5 [@media(max-height:500px)_and_(min-width:640px)]:grid-cols-2">
            <button type="button" className={cn(primary, "[@media(max-height:500px)_and_(min-width:640px)]:col-span-2")} onClick={onResume} autoFocus>
              Resume
            </button>
            {driving && (
              <button type="button" className={secondary} onClick={onUnstuck}>
                Unstuck car <span className="ml-2 text-xs font-medium text-[#1d222b]/60">rights or moves it, damage stays</span>
              </button>
            )}
            <button type="button" className={secondary} onClick={() => onView("help")}>
              Controls
            </button>
            <fieldset className="rounded-xl border border-[#1d222b]/15 bg-white/40 px-3 pb-3 pt-1 [@media(max-height:500px)_and_(min-width:640px)]:row-span-2">
              <legend className="px-1 text-sm font-semibold">Touch controls</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {(["auto", "on", "off"] as const).map((m) => (
                  <label
                    key={m}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold capitalize has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#b3402c]",
                      touchMode === m ? "bg-[#1d222b] text-white" : "bg-white/70 text-[#1d222b] hover:bg-white",
                    )}
                  >
                    <input type="radio" name="touch-mode" value={m} checked={touchMode === m} onChange={() => onTouchMode(m)} className="sr-only" />
                    {m}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#1d222b]/65">Auto shows them when this device has a touch screen.</p>
            </fieldset>
            <button type="button" className={secondary} onClick={onRestart}>
              Restart city <span className="ml-2 text-xs font-medium text-[#1d222b]/60">fresh cars, back to the plaza</span>
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" className={secondary} onClick={onClean}>
                Clean view
              </button>
              <button type="button" className={secondary} onClick={onContact}>
                Contact
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#1d222b]/60">
            Motion: {reduced ? "reduced (camera shake and speed effects are off)" : "full"}, following your system setting.
          </p>
        </div>
      )}
    </Modal>
  );
}

export function HelpContent() {
  const row = (a: string, b: string) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#1d222b]/10 py-1.5 last:border-0">
      <dt className="text-sm text-[#1d222b]/75">{a}</dt>
      <dd className="text-right text-sm font-semibold">{b}</dd>
    </div>
  );
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#b3402c]">Touch</h3>
        <dl className="mt-1">
          {row("Walk / steer", "Left thumb")}
          {row("Look around", "Drag the scenery")}
          {row("Enter / read", "Action button")}
          {row("Gas / brake", "Right pedals")}
          {row("Slide", "Handbrake")}
          {row("Get out", "Get out button")}
        </dl>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#b3402c]">Keyboard</h3>
        <dl className="mt-1">
          {row("Move / drive", "WASD or arrows")}
          {row("Run", "Shift")}
          {row("Jump / handbrake", "Space")}
          {row("Enter, exit, read", "E")}
          {row("Unstuck car", "R")}
          {row("Look around", "Drag with mouse")}
          {row("Pause / close", "Esc")}
        </dl>
      </section>
      <p className="text-sm text-[#1d222b]/75 sm:col-span-2">
        Walk up to any parked car, or a slow one in traffic, to take it. Crash hard enough and it&apos;s wrecked: get out and find another. The brake pedal
        reverses once you have stopped.
      </p>
    </div>
  );
}
