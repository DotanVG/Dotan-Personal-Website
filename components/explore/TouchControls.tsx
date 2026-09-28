"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { stickValue, type InputState } from "@/lib/game/input";
import { clamp } from "@/lib/game/math";
import { cn } from "@/lib/cn";
import type { HudView } from "./uiStore";

type StickValue = ReturnType<typeof stickValue>;
const ZERO: StickValue = { x: 0, y: 0, mag: 0, knobX: 0, knobY: 0 };

/**
 * Floating thumb stick: the base appears where the thumb lands inside its zone.
 * Each stick owns exactly one pointer; other fingers are ignored.
 */
function Stick({
  axis,
  radius,
  onValue,
  label,
  className,
}: {
  axis: "xy" | "x";
  radius: number;
  onValue: (v: StickValue) => void;
  label: string;
  className: string;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const ptr = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const [active, setActive] = useState(false);
  const onValueRef = useRef(onValue);
  onValueRef.current = onValue;

  // Idle ghost sits at the bottom-left of the zone so the thumb knows where to go.
  const placeIdle = () => {
    const z = zone.current;
    if (base.current && z) base.current.style.transform = `translate(16px, ${Math.max(0, z.clientHeight - radius * 2 - 26)}px)`;
    if (knob.current) knob.current.style.transform = "";
  };
  const placeIdleRef = useRef(placeIdle);
  placeIdleRef.current = placeIdle;

  useEffect(() => {
    placeIdleRef.current();
    const onResize = () => {
      if (!ptr.current) placeIdleRef.current();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      onValueRef.current(ZERO);
    };
  }, []);

  const end = (e: React.PointerEvent) => {
    if (ptr.current?.id !== e.pointerId) return;
    ptr.current = null;
    setActive(false);
    placeIdle();
    onValue(ZERO);
  };

  return (
    <div
      ref={zone}
      role="presentation"
      className={cn("pointer-events-auto absolute touch-none select-none", className)}
      onPointerDown={(e) => {
        if (ptr.current || !zone.current) return;
        e.preventDefault();
        zone.current.setPointerCapture(e.pointerId);
        const r = zone.current.getBoundingClientRect();
        const pad = radius + 6;
        const ox = clamp(e.clientX - r.left, pad, Math.max(pad, r.width - pad));
        const oy = clamp(e.clientY - r.top, pad, Math.max(pad, r.height - pad));
        ptr.current = { id: e.pointerId, ox: r.left + ox, oy: r.top + oy };
        if (base.current) base.current.style.transform = `translate(${ox - radius}px, ${oy - radius}px)`;
        setActive(true);
        const v = stickValue(e.clientX - ptr.current.ox, axis === "x" ? 0 : e.clientY - ptr.current.oy, radius);
        if (knob.current) knob.current.style.transform = `translate(${v.knobX}px, ${v.knobY}px)`;
        onValue(v);
      }}
      onPointerMove={(e) => {
        const p = ptr.current;
        if (!p || p.id !== e.pointerId) return;
        const v = stickValue(e.clientX - p.ox, axis === "x" ? 0 : e.clientY - p.oy, radius);
        if (knob.current) knob.current.style.transform = `translate(${v.knobX}px, ${v.knobY}px)`;
        onValue(v);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <div
        ref={base}
        aria-hidden
        className={cn(
          "absolute left-0 top-0 flex items-center justify-center rounded-full border border-white/35 bg-black/25 transition-opacity",
          active ? "opacity-100" : "opacity-60",
        )}
        style={{ width: radius * 2, height: radius * 2 }}
      >
        {axis === "x" && (
          <div className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between text-sm text-white/70">
            <span>◀</span>
            <span>▶</span>
          </div>
        )}
        <div ref={knob} className="size-14 rounded-full border border-white/60 bg-white/80 shadow-md" />
      </div>
      <span className="pointer-events-none absolute bottom-1 left-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80 drop-shadow">
        {label}
      </span>
    </div>
  );
}

/** Button held down by one pointer (pedals, handbrake). */
function HoldButton({
  onChange,
  label,
  className,
  children,
}: {
  onChange: (down: boolean) => void;
  label: string;
  className: string;
  children: ReactNode;
}) {
  const ptr = useRef<number | null>(null);
  const [down, setDown] = useState(false);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => () => cb.current(false), []);
  const release = (e: React.PointerEvent) => {
    if (ptr.current !== e.pointerId) return;
    ptr.current = null;
    setDown(false);
    onChange(false);
  };
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={down}
      className={cn(
        "pointer-events-auto touch-none select-none rounded-2xl border text-white shadow-lg transition-colors",
        down ? "bg-white/35" : "bg-black/35",
        className,
      )}
      onPointerDown={(e) => {
        if (ptr.current !== null) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        ptr.current = e.pointerId;
        setDown(true);
        onChange(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          setDown(true);
          onChange(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          setDown(false);
          onChange(false);
        }
      }}
      onBlur={() => {
        if (ptr.current === null && down) {
          setDown(false);
          onChange(false);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** One-shot action: fires on touch-down; keyboard activation still works via click. */
function TapButton({ onTap, label, className, children }: { onTap: () => void; label: string; className: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "pointer-events-auto touch-none select-none border text-white shadow-lg active:bg-white/35",
        className,
      )}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        onTap();
      }}
      onClick={(e) => {
        // detail === 0: keyboard or assistive activation (pointer taps already fired).
        if (e.detail === 0) onTap();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export function TouchControls({
  input,
  hud,
  onUnstuck,
}: {
  input: InputState;
  hud: HudView;
  onUnstuck: () => void;
}) {
  // When input is cleared (blur, overlay, tab hide), remount the controls so a
  // finger still resting on a pedal or stick is released visually and logically.
  const [epoch, setEpoch] = useState(input.epoch);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (input.epoch !== epoch) setEpoch(input.epoch);
    }, 150);
    return () => window.clearInterval(id);
  }, [input, epoch]);
  return <Controls key={epoch} input={input} hud={hud} onUnstuck={onUnstuck} />;
}

function Controls({ input, hud, onUnstuck }: { input: InputState; hud: HudView; onUnstuck: () => void }) {
  const driving = hud.state === "driving";
  const t = input.touch;
  const bottom = "bottom-[max(14px,env(safe-area-inset-bottom))] [@media(max-height:500px)]:bottom-[max(8px,env(safe-area-inset-bottom))]";
  const right = "right-[max(12px,env(safe-area-inset-right))]";
  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-touch-controls>
      {driving ? (
        <Stick
          key="steer"
          axis="x"
          radius={58}
          label="Steer"
          className={cn("left-0 w-[calc(100%-176px)] max-w-[340px] h-[42%] [@media(max-height:500px)]:h-[62%]", "bottom-0")}
          onValue={(v) => {
            t.steer = v.x;
          }}
        />
      ) : (
        <Stick
          key="move"
          axis="xy"
          radius={52}
          label="Move"
          className="bottom-0 left-0 h-[42%] w-[calc(100%-150px)] max-w-[340px] [@media(max-height:500px)]:h-[64%]"
          onValue={(v) => {
            t.moveX = v.x;
            t.moveY = -v.y;
            // Pushing to the rim runs.
            t.run = v.mag > 0.92;
          }}
        />
      )}

      <div className={cn("absolute flex flex-col items-end gap-3 [@media(max-height:500px)]:gap-2", bottom, right)}>
        {hud.suggestUnstuck && (
          <TapButton label="Unstuck: recover the car" onTap={onUnstuck} className="min-h-12 rounded-full border-amber-200/70 bg-amber-500/80 px-5 text-sm font-semibold">
            Unstuck
          </TapButton>
        )}
        {driving ? (
          <>
            <TapButton
              label={hud.context === "slowToExit" ? "Stop and get out" : "Get out of the car"}
              onTap={() => {
                input.actionQueued = true;
              }}
              className="min-h-12 rounded-full border-white/40 bg-black/45 px-5 text-sm font-semibold"
            >
              Get out
            </TapButton>
            <div className="flex items-end gap-2.5">
              <div className="flex flex-col items-center gap-2.5">
                <HoldButton
                  label="Handbrake"
                  className="size-[60px] rounded-full border-white/40 text-[11px] font-semibold uppercase tracking-wide [@media(max-height:500px)]:size-[52px]"
                  onChange={(d) => {
                    t.handbrake = d;
                  }}
                >
                  Hand
                  <br />
                  brake
                </HoldButton>
                <HoldButton
                  label="Brake and reverse"
                  className="h-[84px] w-[70px] border-[#f0a08a]/70 text-xs font-semibold uppercase tracking-wide [@media(max-height:500px)]:h-[70px]"
                  onChange={(d) => {
                    t.brake = d ? 1 : 0;
                  }}
                >
                  <span aria-hidden className="block text-lg leading-none">▼</span>
                  Brake
                </HoldButton>
              </div>
              <HoldButton
                label="Accelerate"
                className="h-[122px] w-[76px] border-[#f2cf7e]/80 text-xs font-semibold uppercase tracking-wide [@media(max-height:500px)]:h-[96px]"
                onChange={(d) => {
                  t.throttle = d ? 1 : 0;
                }}
              >
                <span aria-hidden className="block text-lg leading-none">▲</span>
                Gas
              </HoldButton>
            </div>
          </>
        ) : (
          <>
            {(hud.context === "enter" || hud.context === "inspect") && (
              <TapButton
                label={hud.contextLabel}
                onTap={() => {
                  input.actionQueued = true;
                }}
                className="min-h-14 max-w-[200px] rounded-full border-[#f2cf7e]/80 bg-black/55 px-5 text-sm font-semibold"
              >
                {hud.contextLabel}
              </TapButton>
            )}
            <TapButton
              label="Jump"
              onTap={() => {
                input.jumpQueued = true;
              }}
              className="size-16 rounded-full border-white/40 bg-black/35 text-xs font-semibold uppercase tracking-wide"
            >
              Jump
            </TapButton>
          </>
        )}
      </div>
    </div>
  );
}
