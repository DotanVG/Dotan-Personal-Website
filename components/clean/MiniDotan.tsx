"use client";

import {
  useCallback,
  useEffect,
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
  lookPose,
  scrollGesture,
  type PetState,
} from "@/lib/miniDotan";
import { experience } from "@/content/experience";
import styles from "./MiniDotan.module.css";

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
  const [walking, setWalking] = useState<"left" | "right" | null>(null);
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
    moved: boolean;
  } | null>(null);
  const dragFrame = useRef(0);
  const walkPause = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const suppressClick = useRef(false);
  const reduced = useReducedMotion();
  const button = useRef<HTMLButtonElement>(null);
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
  const hidden = state === "hidden";
  const still = quiet || reduced || !visible;

  const finishDrag = useCallback((cancelled = false) => {
    const gesture = drag.current;
    if (!gesture) return;
    drag.current = null;
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
    clearTimeout(walkPause.current);
    setWalking(null);
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
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width + 44,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      lastX: event.clientX,
      moved: false,
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
      setMessage("");
      setSettings(false);
      setState("idle");
    }
    const viewport = window.visualViewport;
    const next = clampPetDrag(
      gesture.left + dx,
      gesture.top + dy,
      gesture.width,
      gesture.height,
      viewport?.width ?? innerWidth,
      viewport?.height ?? innerHeight,
      24,
    );
    gesture.x = next.left;
    gesture.y = next.top;
    const horizontal = event.clientX - gesture.lastX;
    if (Math.abs(horizontal) > 2) {
      setWalking(horizontal < 0 ? "left" : "right");
      gesture.lastX = event.clientX;
    }
    clearTimeout(walkPause.current);
    walkPause.current = setTimeout(() => setWalking(null), 160);
    if (!dragFrame.current)
      dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = 0;
        if (drag.current !== gesture) return;
        dock.current?.style.setProperty(
          "--drag-x",
          `${gesture.x - gesture.left}px`,
        );
        dock.current?.style.setProperty(
          "--drag-y",
          `${gesture.y - gesture.top}px`,
        );
      });
  }

  useEffect(() => {
    const cancel = () => finishDrag(true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      cancelAnimationFrame(dragFrame.current);
      clearTimeout(walkPause.current);
    };
  }, [finishDrag]);

  useEffect(() => {
    if (
      still &&
      ["idle", "greeting", "hopping", "speaking"].includes(
        current.current.state,
      )
    ) {
      setMessage("");
      setState("idle");
    }
  }, [still]);

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
    sprite.current?.style.setProperty("--row", String(row));
    sprite.current?.style.setProperty("--col", String(col));
  }

  useEffect(() => {
    setQuiet(preference("quiet"));
    setSide(preference("left") ? "left" : "right");
    if (preference("hidden")) setState("hidden");
    setReady(true);
    const show = () => {
      preference("hidden", false);
      if (current.current.state === "hidden") setState("idle");
    };
    const visibility = () => setVisible(!document.hidden);
    visibility();
    window.addEventListener("mini-dotan-show", show);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("mini-dotan-show", show);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!ready || hidden) return;
    paint();
    if (still || settings) return;
    const cycle = cycles[walking ?? (state as keyof typeof cycles)];
    if (!cycle) return;
    let timer: ReturnType<typeof setTimeout>;
    let col = 0;
    const frame = () => {
      if (
        !walking &&
        state === "idle" &&
        Number(sprite.current?.style.getPropertyValue("--row")) >= 9
      ) {
        timer = setTimeout(frame, 250);
        return;
      }
      paint(cycle.row, col);
      timer = setTimeout(() => {
        col++;
        if (col < cycle.times.length) frame();
        else if (walking || state === "idle" || state === "submitting") {
          col = 0;
          paint();
          timer = setTimeout(frame, !walking && state === "idle" ? 6500 : 0);
        } else {
          paint();
          if (state === "greeting") setState("speaking");
          if (state === "hopping") setState("idle");
        }
      }, cycle.times[col]);
    };
    // Begin idle with a still pause; direct reactions play immediately.
    timer = setTimeout(frame, !walking && state === "idle" ? 6500 : 0);
    return () => clearTimeout(timer);
  }, [state, still, hidden, ready, settings, walking]);

  useEffect(() => {
    if (!ready || hidden || still) return;
    let intent = 0,
      lastScroll = 0,
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
    let pose: number | null = null;
    let raf = 0;
    let messageUntil = 0;
    const candidates = new Map<string, number>();
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const busy = () =>
      !!drag.current ||
      current.current.open ||
      current.current.settings ||
      !!document.activeElement?.closest(
        "input, textarea, select, [contenteditable=true]",
      );
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
      paint();
    };
    const userIntent = (event: Event) => {
      if (
        (event.target as Element)?.closest?.(
          "[data-mini-dotan], input, textarea, select, [contenteditable=true]",
        )
      )
        return;
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
    const click = (event: Event) => {
      lastActivity = performance.now();
      pointer = null;
      if (current.current.state === "idle") paint();
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
    const leave = () => {
      pointer = null;
      pose = null;
      if (current.current.state === "idle") paint();
    };
    const scroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const now = performance.now();
        lastScroll = now;
        lastActivity = now;
        pointer = null;
        if (current.current.state === "idle") paint();
        const eligible =
          intent > 0 &&
          now - intent < 900 &&
          now > suppressUntil &&
          !busy() &&
          ["idle", "greeting", "speaking"].includes(current.current.state);
        const next = scrollGesture(gesture, position(), now, eligible);
        gesture = next;
        if (next.hop) {
          messageUntil = 0;
          setMessage("");
          setState("hopping");
        }
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
      if (pointer && now - lastScroll > 350) {
        const rect = button.current?.getBoundingClientRect();
        if (rect) {
          pose = lookPose(
            pointer.x - (rect.left + rect.width / 2),
            pointer.y - (rect.top + rect.height * 0.25),
            pose,
          );
          if (pose === null) paint();
          else paint(9 + Math.floor(pose / 8), pose % 8);
        }
      }
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
        paint();
        setMessage(line);
        messageUntil = now + 8500;
      }
    }, 100);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("wheel", userIntent, { passive: true });
    window.addEventListener("touchmove", userIntent, { passive: true });
    window.addEventListener("keydown", userIntent);
    window.addEventListener("pointerdown", click, { passive: true });
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
      window.removeEventListener("touchmove", userIntent);
      window.removeEventListener("keydown", userIntent);
      window.removeEventListener("pointerdown", click);
      window.removeEventListener("click", click);
      window.removeEventListener("resize", reset);
      window.visualViewport?.removeEventListener("resize", reset);
    };
  }, [ready, hidden, still]);

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
    <aside
      ref={dock}
      data-mini-dotan
      data-state={state}
      data-side={side}
      className={styles.dock}
      hidden={hidden}
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
      {!open && message && !still && (
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
              document
                .querySelector<HTMLButtonElement>("[data-show-mini-dotan]")
                ?.focus({ preventScroll: true });
            }}
          >
            Hide Mini Dotan
          </button>
        </div>
      )}
      <div className={styles.controls}>
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
          <span id="mini-dotan-drag-help" className="sr-only">
            Tap to contact Dotan. Drag to either bottom corner, or move using
            Mini Dotan settings.
          </span>
        </button>
        {!open && state !== "submitting" && (
          <button
            type="button"
            className={styles.gear}
            aria-label="Mini Dotan settings"
            aria-expanded={settings}
            onClick={() => {
              setSettings(!settings);
              setMessage("");
              setState("idle");
            }}
          >
            ···
          </button>
        )}
      </div>
    </aside>,
    document.body,
  );
}
