"use client";

import { create } from "zustand";
import type { ContextKind, PlayerState } from "@/lib/game/sim";

export type Overlay = "none" | "pause" | "info";
export type TouchMode = "auto" | "on" | "off";
export type Status = "loading" | "ready" | "lost";

/** Discrete HUD fields: React re-renders only when one of these changes. */
export type HudView = {
  state: PlayerState;
  context: ContextKind;
  contextLabel: string;
  suggestUnstuck: boolean;
  wrecked: boolean;
  vehicle: string | null;
  nearLandmark: string | null;
};

type ExploreUi = {
  overlay: Overlay;
  pauseView: "menu" | "help";
  infoSlug: string | null;
  hud: HudView;
  toast: { text: string; id: number } | null;
  touchMode: TouchMode;
  sawTouch: boolean;
  coarse: boolean;
  status: Status;
  coach: boolean;
  openPause: (view?: "menu" | "help") => void;
  openInfo: (slug: string) => void;
  close: () => void;
  setHud: (h: HudView) => void;
  setToast: (t: ExploreUi["toast"]) => void;
  setTouchMode: (m: TouchMode) => void;
  setStatus: (s: Status) => void;
  setCoach: (v: boolean) => void;
};

const TOUCH_KEY = "dotanv-explore-touch";
export const COACH_KEY = "dotanv-explore-coach-seen";

/** Storage may be blocked (private mode, policy): never let that break the game. */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignored: preferences simply won't persist
  }
}

const sameHud = (a: HudView, b: HudView) =>
  a.state === b.state &&
  a.context === b.context &&
  a.contextLabel === b.contextLabel &&
  a.suggestUnstuck === b.suggestUnstuck &&
  a.wrecked === b.wrecked &&
  a.vehicle === b.vehicle &&
  a.nearLandmark === b.nearLandmark;

export const useExploreUi = create<ExploreUi>((set, get) => ({
  overlay: "none",
  pauseView: "menu",
  infoSlug: null,
  hud: {
    state: "onFoot",
    context: "none",
    contextLabel: "",
    suggestUnstuck: false,
    wrecked: false,
    vehicle: null,
    nearLandmark: null,
  },
  toast: null,
  touchMode: "auto",
  sawTouch: false,
  coarse: false,
  status: "loading",
  coach: false,
  openPause: (view = "menu") => set({ overlay: "pause", pauseView: view }),
  openInfo: (slug) => set({ overlay: "info", infoSlug: slug }),
  close: () => set({ overlay: "none" }),
  setHud: (h) => {
    if (!sameHud(get().hud, h)) set({ hud: { ...h } });
  },
  setToast: (t) => set({ toast: t }),
  setTouchMode: (m) => {
    writeStorage(TOUCH_KEY, m);
    set({ touchMode: m });
  },
  setStatus: (s) => set({ status: s }),
  setCoach: (v) => set({ coach: v }),
}));

export function initialTouchMode(): TouchMode {
  const v = readStorage(TOUCH_KEY);
  return v === "on" || v === "off" ? v : "auto";
}

export function touchVisible(s: Pick<ExploreUi, "touchMode" | "sawTouch" | "coarse">) {
  return s.touchMode === "on" || (s.touchMode === "auto" && (s.coarse || s.sawTouch));
}
