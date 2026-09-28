"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ContactForm, type ContactStatus } from "./ContactForm";
import { useReducedMotion } from "@/lib/useReducedMotion";
import {
  cycles,
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
  }, [ready]);

  function paint(row = 0, col = 0) {
    sprite.current?.style.setProperty("--row", String(row));
    sprite.current?.style.setProperty("--col", String(col));
  }

  useEffect(() => {
    setQuiet(preference("quiet"));
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
    const cycle = cycles[state as keyof typeof cycles];
    if (!cycle) return;
    let timer: ReturnType<typeof setTimeout>;
    let col = 0;
    const frame = () => {
      if (
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
        else if (state === "idle" || state === "submitting") {
          col = 0;
          paint();
          timer = setTimeout(frame, state === "idle" ? 6500 : 0);
        } else {
          paint();
          if (state === "greeting") setState("speaking");
          if (state === "hopping") setState("idle");
        }
      }, cycle.times[col]);
    };
    // Begin idle with a still pause; direct reactions play immediately.
    timer = setTimeout(frame, state === "idle" ? 6500 : 0);
    return () => clearTimeout(timer);
  }, [state, still, hidden, ready, settings]);

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
      className={styles.dock}
      hidden={hidden}
      aria-label="Mini Dotan companion"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
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
          className={styles.pet}
          onClick={() => {
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
