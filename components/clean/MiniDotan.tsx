"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { ContactForm, type ContactStatus } from "./ContactForm";
import { useReducedMotion } from "@/lib/useReducedMotion";
import {
  cycles,
  clampPetDrag,
  liftTarget,
  lookPose,
  scrollGesture,
  startWalk,
  walkFrame,
  walkStep,
  type PetState,
  type Walk,
} from "@/lib/miniDotan";
import { experience } from "@/content/experience";
import styles from "./MiniDotan.module.css";

/** Compiled out of production builds (see next.config.ts). */
const DEBUG = process.env.MINI_DEBUG === "1";
/** Still pause between idle gestures, ms. */
const idlePause = () => 2500 + Math.random() * 1500;

function preference(key: string, value?: boolean): boolean {
  try {
    if (value !== undefined)
      localStorage.setItem(`mini-dotan-${key}`, String(value));
    return localStorage.getItem(`mini-dotan-${key}`) === "true";
  } catch {
    return value ?? false;
  }
}

export function MiniDotan() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PetState>("idle");
  const [quiet, setQuiet] = useState(false);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(true);
  const [side, setSide] = useState<"left" | "right">("right");
  const [dragging, setDragging] = useState(false);
  const [arriving, setArriving] = useState(false);
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    left: number;
    top: number;
    width: number;
    height: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    walk: Walk;
    moved: boolean;
    // Touch: held above the finger instead of under it (mouse drags don't lift).
    lift: boolean;
    liftAt: number;
    gx: number; // where he'd be without the lift, to rise from
    gy: number;
  } | null>(null);
  const dragFrame = useRef(0);
  const glideFrom = useRef<DOMRect | null>(null);
  const arriveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const walkPause = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const suppressClick = useRef(false);
  const reduced = useReducedMotion();
  const button = useRef<HTMLButtonElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  const sprite = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLElement>(null);
  const current = useRef({ state, open, settings });
  current.current = { state, open, settings };
  const budget = useRef({
    count: 0,
    last: -Infinity,
    greeted: false,
    seen: new Set<string>(),
  });
  const formStatus = useRef<ContactStatus>("idle");
  const diag = useRef({ frames: 0, scrolls: 0, hops: 0, greetings: 0, glances: 0 });
  const [debug, setDebug] = useState(false);
  const hidden = state === "hidden";
  // Nothing unsolicited: no idle gestures, glances, scroll reactions or messages.
  const mute = quiet || !visible;
  // Reduced motion keeps him in place: glances, a blink and held poses instead of
  // bouncing or looping; sequences play only in direct response to the visitor
  // (the walk follows their finger). Quiet mode on top of it makes him fully still.

  const finishDrag = useCallback((cancelled = false) => {
    const gesture = drag.current;
    if (!gesture) return;
    drag.current = null;
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
    clearTimeout(walkPause.current);
    setDragging(false);
    // A lifted (touch) drag glides into its corner from here; see the layout effect.
    if (gesture.moved && gesture.lift)
      glideFrom.current = button.current?.getBoundingClientRect() ?? null;
    dock.current?.removeAttribute("data-lifted");
    dock.current?.style.removeProperty("--drag-x");
    dock.current?.style.removeProperty("--drag-y");
    if (gesture.moved) {
      suppressClick.current = true;
      if (!cancelled) {
        const viewport = window.visualViewport;
        const next = clampPetDrag(
          gesture.x,
          gesture.y,
          gesture.width,
          gesture.height,
          viewport?.width ?? innerWidth,
          viewport?.height ?? innerHeight,
          24,
        );
        setSide(next.side);
        preference("left", next.side === "left");
      }
    }
  }, []);

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    suppressClick.current = false;
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      open ||
      formStatus.current === "submitting"
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    const lift = event.pointerType !== "mouse";
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      // The settings button travels along, except when lifted (it hides then).
      width: rect.width + (lift ? 0 : 44),
      height: rect.height,
      x: rect.left,
      y: rect.top,
      lastX: event.clientX,
      lastY: event.clientY,
      walk: startWalk(1),
      moved: false,
      lift,
      liftAt: 0,
      gx: rect.left,
      gy: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.startX,
      dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) < 12) return;
    if (!gesture.moved) {
      gesture.moved = true;
      gesture.walk = startWalk(dx < 0 ? -1 : 1);
      setMessage("");
      setSettings(false);
      setState("idle");
      setDragging(true);
      if (gesture.lift) {
        gesture.liftAt = performance.now();
        dock.current?.setAttribute("data-lifted", "");
      }
    } else
      gesture.walk = walkStep(
        gesture.walk,
        event.clientX - gesture.lastX,
        event.clientY - gesture.lastY,
        performance.now(),
      );
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    const viewport = window.visualViewport;
    const vw = viewport?.width ?? innerWidth,
      vh = viewport?.height ?? innerHeight;
    const grab = clampPetDrag(
      gesture.left + dx,
      gesture.top + dy,
      gesture.width,
      gesture.height,
      vw,
      vh,
      24,
    );
    const next = gesture.lift
      ? liftTarget(event.clientX, event.clientY, gesture.width, gesture.height, vw, vh)
      : grab;
    gesture.gx = grab.left;
    gesture.gy = grab.top;
    gesture.x = next.left;
    gesture.y = next.top;
    // Painted directly: one React render per drag, not one per frame.
    const walk = gesture.walk;
    paint(...walkFrame(walk, quiet && reduced));
    clearTimeout(walkPause.current);
    // Finger resting: face the way he was going (look poses 4 and 12).
    if (!walk.carried && !(quiet && reduced))
      walkPause.current = setTimeout(
        () => drag.current === gesture && paint(walk.dir > 0 ? 9 : 10, 4),
        150,
      );
    const place = () => {
      dragFrame.current = 0;
      if (drag.current !== gesture) return;
      let { x, y } = gesture;
      if (gesture.lift) {
        // Rise from under the finger to above it: 140 ms ease-out, finishing
        // even if the finger stops. Reduced motion: straight there.
        const p = reduced
          ? 1
          : Math.min(1, (performance.now() - gesture.liftAt) / 140);
        const e = 1 - (1 - p) ** 3;
        x = gesture.gx + (x - gesture.gx) * e;
        y = gesture.gy + (y - gesture.gy) * e;
        if (p < 1) dragFrame.current = requestAnimationFrame(place);
      }
      dock.current?.style.setProperty("--drag-x", `${x - gesture.left}px`);
      dock.current?.style.setProperty("--drag-y", `${y - gesture.top}px`);
    };
    if (!dragFrame.current) dragFrame.current = requestAnimationFrame(place);
  }

  // Glide a released touch drag from where he was held into the corner (FLIP).
  useLayoutEffect(() => {
    const from = glideFrom.current;
    glideFrom.current = null;
    const to = button.current?.getBoundingClientRect();
    if (!from || !to || reduced) return;
    dock.current?.animate(
      [
        {
          transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`,
        },
        { transform: "none" },
      ],
      { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
  }, [side, dragging, reduced]);

  /** Back from hidden: he jumps up from below the screen; the button whirls. */
  const summon = useCallback(() => {
    preference("hidden", false);
    if (current.current.state !== "hidden") return;
    clearTimeout(arriveTimer.current);
    setArriving(true);
    // Outlasts the 1.1 s whirl in MiniDotan.module.css.
    arriveTimer.current = setTimeout(() => setArriving(false), 1200);
    setState(
      matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "idle"
        : "hopping",
    );
  }, []);

  useEffect(() => {
    const cancel = () => finishDrag(true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      cancelAnimationFrame(dragFrame.current);
      clearTimeout(walkPause.current);
      clearTimeout(arriveTimer.current);
    };
  }, [finishDrag]);

  useEffect(() => {
    const now = current.current.state;
    if (mute && ["idle", "greeting", "hopping", "speaking"].includes(now)) {
      setMessage("");
      setState("idle");
    } else if (reduced && now === "hopping") setState("idle");
  }, [reduced, mute]);

  useEffect(() => {
    if (!ready) return;
    const viewport = window.visualViewport;
    const resize = () => {
      finishDrag(true);
      const height = viewport?.height ?? innerHeight;
      dock.current?.style.setProperty("--available-height", `${height}px`);
      dock.current?.style.setProperty(
        "--keyboard",
        `${Math.max(0, innerHeight - height - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
    };
  }, [ready, finishDrag]);

  function paint(row = 0, col = 0) {
    if (DEBUG && (row || col)) diag.current.frames++;
    sprite.current?.style.setProperty("--row", String(row));
    sprite.current?.style.setProperty("--col", String(col));
  }


  useEffect(() => {
    setQuiet(preference("quiet"));
    setSide(preference("left") ? "left" : "right");
    if (preference("hidden")) setState("hidden");
    setReady(true);
    if (DEBUG) setDebug(new URLSearchParams(location.search).has("mini-debug"));
    const visibility = () => setVisible(!document.hidden);
    visibility();
    window.addEventListener("mini-dotan-show", summon);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("mini-dotan-show", summon);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [summon]);

  useEffect(() => {
    // While dragged, moveDrag paints the walk itself.
    if (!ready || hidden || dragging) return;
    paint();
    if (settings) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => clearTimeout(timer);
    // A glance (look rows 9+) wins over idle frames until it ends.
    const looking = () =>
      Number(sprite.current?.style.getPropertyValue("--row")) >= 9;
    if (state === "idle" && mute) return;
    if (reduced) {
      if (quiet) return;
      if (state === "idle") {
        // Reduced motion: an occasional blink is his only idle animation.
        const blink = () => {
          timer = setTimeout(() => {
            if (!looking()) paint(0, 3);
            timer = setTimeout(() => {
              if (!looking()) paint();
              blink();
            }, 140);
          }, 6000 + Math.random() * 4000);
        };
        blink();
        return stop;
      }
      if (state === "submitting") {
        paint(cycles.submitting.row, 1);
        return;
      }
      if (state === "greeting") {
        paint(cycles.greeting.row, 1); // hand up, held
        timer = setTimeout(() => {
          paint();
          setState("speaking");
        }, 900);
        return stop;
      }
    }
    // Opening the contact form gets one wave.
    const cycle =
      cycles[
        (state === "contact-open" ? "greeting" : state) as keyof typeof cycles
      ];
    if (!cycle) return;
    let col = 0;
    const frame = () => {
      if (state === "idle" && looking()) {
        timer = setTimeout(frame, 250);
        return;
      }
      paint(cycle.row, col);
      timer = setTimeout(() => {
        col++;
        if (col < cycle.times.length) frame();
        else if (state === "idle" || state === "submitting") {
          col = 0;
          paint();
          timer = setTimeout(frame, state === "idle" ? idlePause() : 0);
        } else {
          paint();
          if (state === "greeting") setState("speaking");
          if (state === "hopping") setState("idle");
        }
      }, cycle.times[col]);
    };
    // Begin idle with a still pause; direct reactions play immediately.
    timer = setTimeout(frame, state === "idle" ? idlePause() : 0);
    return stop;
  }, [state, mute, quiet, reduced, hidden, ready, settings, dragging]);

  useEffect(() => {
    if (!ready || hidden || mute) return;
    let intent = 0,
      lastScroll = -Infinity,
      suppressUntil = 0,
      lastActivity = performance.now();
    let gesture = {
      y: window.scrollY,
      at: 0,
      distance: 0,
      hopped: false,
      lastHop: -Infinity,
    };
    let pointer: { x: number; y: number } | null = null;
    // One finger on the page (phones). Pointer events end in pointercancel once
    // iOS starts panning, so this follows touch events instead.
    let finger: {
      x: number;
      y: number;
      x0: number;
      y0: number;
      down: boolean;
      scrolling: boolean; // moved past tap slop: a scroll, not a tap
      tap: boolean;
      lift: number;
      follow: boolean; // first gesture of a scroll session
    } | null = null;
    let pose: number | null = null,
      posed = -Infinity;
    let raf = 0;
    let messageUntil = 0;
    const candidates = new Map<string, number>();
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const coarse = matchMedia("(pointer: coarse)");
    const ignored =
      "[data-mini-dotan], input, textarea, select, [contenteditable=true]";
    const looking = () =>
      Number(sprite.current?.style.getPropertyValue("--row")) >= 9;
    // Drop a glance pose (rows 9+) without interrupting an idle gesture.
    const clearLook = () => {
      if (current.current.state === "idle" && looking()) paint();
    };
    const busy = () =>
      !!drag.current ||
      current.current.open ||
      current.current.settings ||
      !!document.activeElement?.closest(
        "input, textarea, select, [contenteditable=true]",
      );
    /** Glance toward a viewport point; reduced motion changes pose at most every 300 ms. */
    const aim = (x: number, y: number, now: number, hysteresis = 20) => {
      const rect = button.current?.getBoundingClientRect();
      if (
        !rect ||
        busy() ||
        current.current.state !== "idle" ||
        now - posed < (reduced ? 300 : 0)
      )
        return;
      const next = lookPose(
        x - (rect.left + rect.width / 2),
        y - (rect.top + rect.height * 0.25),
        pose,
        hysteresis,
      );
      if (next === pose && (next === null || looking())) return;
      pose = next;
      posed = now;
      if (next === null) return clearLook();
      if (DEBUG) diag.current.glances++;
      paint(9 + Math.floor(next / 8), next % 8);
    };
    const neutral = () => {
      pose = null;
      clearLook();
    };
    const hop = () => {
      if (DEBUG) diag.current.hops++;
      messageUntil = 0;
      setMessage("");
      setState("hopping");
    };
    const position = () =>
      Math.max(
        0,
        Math.min(
          window.scrollY,
          document.documentElement.scrollHeight - innerHeight,
        ),
      );
    const reset = () => {
      gesture = {
        ...gesture,
        y: position(),
        at: 0,
        distance: 0,
        hopped: false,
      };
      intent = 0;
      pointer = null;
      // iOS resizes as its toolbar collapses mid-scroll; keep a finger glance.
      if (!finger) neutral();
    };
    const userIntent = (event: Event) => {
      if ((event.target as Element)?.closest?.(ignored)) return;
      if (
        event instanceof KeyboardEvent &&
        ![
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        return;
      intent = performance.now();
      lastActivity = intent;
    };
    const press = () => {
      lastActivity = performance.now();
      pointer = null;
      if (!finger) neutral(); // a tap's glance outlives its click
    };
    const click = (event: Event) => {
      press();
      // An in-page link scrolls the page itself: no hop for that. Only on a real
      // click; a swipe that merely starts on such a link is the visitor scrolling.
      if ((event.target as Element)?.closest?.('a[href*="#"]')) {
        suppressUntil = performance.now() + 1800;
        reset();
      }
    };
    const move = (event: PointerEvent) => {
      pointer =
        event.pointerType === "mouse" &&
        fine.matches &&
        !event.buttons &&
        !(event.target as Element)?.closest?.("[data-mini-dotan]")
          ? { x: event.clientX, y: event.clientY }
          : null;
    };
    const leave = (event: PointerEvent) => {
      // Touch pointers "leave" on every lift and when a pan starts; only a mouse
      // leaving the window ends a glance.
      if (event.pointerType !== "mouse") return;
      pointer = null;
      neutral();
    };
    const touchStart = (event: TouchEvent) => {
      const t = event.touches[0];
      const now = performance.now();
      lastActivity = now;
      if (
        event.touches.length !== 1 ||
        (event.target as Element)?.closest?.(ignored) ||
        busy()
      ) {
        // A second finger (pinch) or a form field: back to neutral.
        if (finger) {
          finger = null;
          neutral();
        }
        return;
      }
      // Nothing yet: whether this is a tap or a scroll is known only once it
      // moves or lifts.
      finger = {
        x: t.clientX,
        y: t.clientY,
        x0: t.clientX,
        y0: t.clientY,
        down: true,
        scrolling: false,
        tap: false,
        lift: 0,
        follow: now - lastScroll > 2500,
      };
    };
    const touchMove = (event: TouchEvent) => {
      userIntent(event);
      const t = event.touches[0];
      if (!finger?.down || event.touches.length !== 1 || !t) return;
      finger.x = t.clientX;
      finger.y = t.clientY;
      if (
        finger.scrolling ||
        Math.hypot(finger.x - finger.x0, finger.y - finger.y0) < 10
      )
        return;
      finger.scrolling = true;
      // A scroll: with motion he hops (see scroll); with reduced motion, which
      // has no hops, he glances at the finger on the first swipe of a session.
      if (reduced && finger.follow) aim(finger.x, finger.y, performance.now());
      else neutral();
    };
    const touchEnd = (event: TouchEvent) => {
      if (!finger?.down || event.touches.length) return;
      const now = performance.now();
      finger.down = false;
      finger.lift = now;
      finger.tap = event.type === "touchend" && !finger.scrolling;
      // Every tap gets a glance, even mid-reading.
      if (finger.tap) aim(finger.x, finger.y, now);
    };
    /** Glance at the mouse, a tap, or (reduced motion) the scrolling finger. */
    const updateLook = (now: number) => {
      if (pointer) {
        if (now - lastScroll > 350) aim(pointer.x, pointer.y, now, 15);
        return;
      }
      if (!finger) return;
      const end = finger.down
        ? Infinity
        : finger.tap
          ? finger.lift + 700
          : Math.max(finger.lift, lastScroll) + 500;
      if (now >= end) {
        finger = null;
        neutral();
      }
    };
    const scroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const now = performance.now(),
          y = position();
        lastScroll = now;
        lastActivity = now;
        pointer = null;
        if (DEBUG) diag.current.scrolls++;
        // The mouse glance ends; a finger glance carries on. An idle gesture keeps playing.
        if (!finger) neutral();
        // A phone swipe keeps the page coasting for a while after the finger
        // lifts, so touch intent lasts longer; one hop per swipe either way.
        const eligible =
          !reduced &&
          intent > 0 &&
          now - intent < (coarse.matches ? 3000 : 900) &&
          now > suppressUntil &&
          !busy() &&
          ["idle", "greeting", "speaking"].includes(current.current.state);
        const next = scrollGesture(
          gesture,
          y,
          now,
          eligible,
          coarse.matches ? 3000 : 6000,
        );
        gesture = next;
        if (next.hop) hop();
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slug = (entry.target as HTMLElement).dataset.petContext!;
          if (entry.isIntersecting) candidates.set(slug, performance.now());
          else candidates.delete(slug);
        }
      },
      { threshold: 0.35 },
    );
    document
      .querySelectorAll("[data-pet-context]")
      .forEach((el) => observer.observe(el));
    const tick = setInterval(() => {
      const now = performance.now();
      if (busy()) return;
      if (messageUntil && now > messageUntil) {
        messageUntil = 0;
        setMessage("");
        if (["speaking", "greeting"].includes(current.current.state))
          setState("idle");
      }
      if (current.current.state !== "idle") return;
      updateLook(now);
      const b = budget.current;
      if (
        b.count >= 3 ||
        now - b.last < 45000 ||
        now - lastActivity < (b.greeted ? 1200 : 5000)
      )
        return;
      let line = "";
      if (!b.greeted) {
        b.greeted = true;
        if (DEBUG) diag.current.greetings++;
        line =
          "Hi, I’m Mini Dotan. Tap me whenever you’d like to get in touch.";
        setState("greeting");
      } else {
        for (const [slug, since] of candidates) {
          const item = experience.find((item) => item.slug === slug);
          if (item && now - since >= 1200 && !b.seen.has(slug)) {
            line = `${item.company}: ${item.blurb}`;
            b.seen.add(slug);
            setState("speaking");
            break;
          }
        }
      }
      if (line) {
        b.count++;
        b.last = now;
        pointer = null;
        finger = null;
        pose = null;
        paint();
        setMessage(line);
        messageUntil = now + 8500;
      }
    }, 100);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("wheel", userIntent, { passive: true });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: true });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", touchEnd, { passive: true });
    window.addEventListener("keydown", userIntent);
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("click", click);
    window.addEventListener("resize", reset);
    window.visualViewport?.addEventListener("resize", reset);
    return () => {
      clearInterval(tick);
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("wheel", userIntent);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchEnd);
      window.removeEventListener("keydown", userIntent);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("click", click);
      window.removeEventListener("resize", reset);
      window.visualViewport?.removeEventListener("resize", reset);
    };
  }, [ready, hidden, reduced, mute]);

  useEffect(() => {
    if (!open) return;
    const focus = () => {
      const target =
        bubble.current?.querySelector<HTMLElement>("input:not(:disabled)") ??
        bubble.current?.querySelector<HTMLElement>("button");
      target?.focus({ preventScroll: true });
    };
    focus();
    // The reused form replaces its children after success and “Send another”.
    const observer = new MutationObserver(() => {
      if (document.activeElement === document.body) focus();
    });
    if (bubble.current)
      observer.observe(bubble.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  function close() {
    setOpen(false);
    setSettings(false);
    setMessage("");
    setState(formStatus.current === "submitting" ? "submitting" : "idle");
    button.current?.focus({ preventScroll: true });
  }
  function statusChanged(status: ContactStatus) {
    formStatus.current = status;
    setState(
      current.current.open
        ? status === "idle"
          ? "contact-open"
          : status
        : "idle",
    );
  }
  if (!ready) return null;
  return createPortal(
    <>
    {DEBUG && debug && (
      <MiniDebug
        read={() => ({
          quiet,
          reducedMotion: reduced,
          tabVisible: visible,
          state,
          dragging,
          frame: `${sprite.current?.style.getPropertyValue("--row") || 0},${sprite.current?.style.getPropertyValue("--col") || 0}`,
          ...diag.current,
        })}
      />
    )}
    <aside
      ref={dock}
      data-mini-dotan
      data-state={state}
      data-side={side}
      data-arriving={arriving || undefined}
      className={styles.dock}
      aria-label="Mini Dotan companion"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          finishDrag(true);
          close();
        }
      }}
    >
      <div
        id="mini-dotan-contact"
        ref={bubble}
        hidden={!open}
        role="dialog"
        aria-label="Contact Dotan"
        className={styles.bubble}
      >
        <div className={styles.heading}>
          <div>
            <strong>Let’s build something.</strong>
            <p>A note straight to Dotan.</p>
          </div>
          <button type="button" aria-label="Close contact form" onClick={close}>
            ×
          </button>
        </div>
        <ContactForm compact onStatusChange={statusChanged} />
      </div>
      {!open && message && !mute && (
        <div className={`${styles.bubble} ${styles.message}`}>
          <p>{message}</p>
          <button type="button" aria-label="Dismiss message" onClick={close}>
            ×
          </button>
        </div>
      )}
      {!open && settings && (
        <div className={`${styles.bubble} ${styles.settings}`}>
          <p className="px-2 py-2 text-xs text-ink/60">
            Drag Mini Dotan to either bottom corner, or use this button.
          </p>
          <button
            type="button"
            onClick={() => {
              const next = side === "right" ? "left" : "right";
              setSide(next);
              preference("left", next === "left");
            }}
          >
            Move to {side === "right" ? "left" : "right"} corner
          </button>
          <button
            type="button"
            aria-pressed={quiet}
            onClick={() => {
              const value = !quiet;
              setQuiet(value);
              preference("quiet", value);
              setMessage("");
              setState("idle");
            }}
          >
            Quiet mode <span>{quiet ? "On" : "Off"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              preference("hidden", true);
              setSettings(false);
              setMessage("");
              setState("hidden");
              // The same round button stays, now as "Show Mini Dotan".
              gear.current?.focus({ preventScroll: true });
            }}
          >
            Hide Mini Dotan
          </button>
        </div>
      )}
      <div className={styles.controls}>
        {!hidden && (
        <button
          ref={button}
          type="button"
          aria-label="Contact Dotan"
          aria-expanded={open}
          aria-controls="mini-dotan-contact"
          aria-describedby="mini-dotan-drag-help"
          className={styles.pet}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={(event) => {
            if (drag.current?.id === event.pointerId) finishDrag();
          }}
          onPointerCancel={(event) => {
            if (drag.current?.id === event.pointerId) finishDrag(true);
          }}
          onLostPointerCapture={(event) => {
            if (drag.current?.id === event.pointerId) finishDrag(true);
          }}
          onClick={(event) => {
            if (event.detail !== 0 && suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            setMessage("");
            setSettings(false);
            setOpen(true);
            setState(
              formStatus.current === "idle"
                ? "contact-open"
                : formStatus.current,
            );
          }}
        >
          <span ref={sprite} className={styles.sprite} aria-hidden="true" />
          {quiet && (
            <span className={styles.quietBadge} aria-hidden="true">
              zz
            </span>
          )}
          <span id="mini-dotan-drag-help" className="sr-only">
            Tap to contact Dotan. Drag to either bottom corner, or move using
            Mini Dotan settings.{quiet ? " Quiet mode is on." : ""}
          </span>
        </button>
        )}
        {!open && state !== "submitting" && (
          <button
            ref={gear}
            type="button"
            className={styles.gear}
            aria-label={hidden ? "Show Mini Dotan" : "Mini Dotan settings"}
            aria-expanded={hidden ? undefined : settings}
            onClick={() => {
              if (hidden) return summon();
              setSettings(!settings);
              setMessage("");
              setState("idle");
            }}
          >
            <span className={styles.face} aria-hidden="true" />
            <span className={styles.dots} aria-hidden="true">
              ···
            </span>
          </button>
        )}
      </div>
    </aside>
    </>,
    document.body,
  );
}

/** Staging-only readout (?mini-debug) of what this device reports, plus a reset. */
function MiniDebug({ read }: { read: () => Record<string, string | number | boolean> }) {
  const [, tick] = useState(0);
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const values = readRef.current();
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 60,
        maxWidth: 260,
        padding: "8px 10px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.82)",
        color: "#fff",
        font: "12px/1.45 ui-monospace, monospace",
      }}
    >
      <strong>Mini Dotan debug</strong>
      {Object.entries(values).map(([k, v]) => (
        <div key={k}>
          {k}: {String(v)}
        </div>
      ))}
      <div style={{ opacity: 0.7, wordBreak: "break-word" }}>{navigator.userAgent.slice(0, 90)}</div>
      <button
        type="button"
        style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: "#fff", color: "#000" }}
        onClick={() => {
          try {
            ["quiet", "left", "hidden"].forEach((k) => localStorage.removeItem(`mini-dotan-${k}`));
          } catch {
            // storage blocked
          }
          location.reload();
        }}
      >
        Reset Mini Dotan settings
      </button>
    </div>
  );
}
