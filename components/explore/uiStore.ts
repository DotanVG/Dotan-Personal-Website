"use client";

import { create } from "zustand";
import { applyEvent, DEFAULT_MISSIONS, MISSIONS_KEY, type MissionState, type RewardCopy } from "@/lib/game/missions";
import type { ContextKind, PlayerState } from "@/lib/game/sim";

export type Overlay = "none" | "pause" | "info";
export type PauseView = "menu" | "help" | "missions";
export type TouchMode = "auto" | "on" | "off";
export type Status = "loading" | "ready" | "lost";
export type Aim = { slug: string; name: string } | null;

/** Written from the HUD frame, read by the chip arrow and the light pillar. */
export const missionRefs = {
  arrow: null as HTMLElement | null,
  pillar: null as { x: number; z: number; near: boolean } | null,
};

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
  pauseView: PauseView;
  infoSlug: string | null;
  missions: MissionState;
  aim: Aim;
  sound: boolean;
  reward: RewardCopy | null;
  pendingReward: RewardCopy | null;
  revealed: string[];
  epoch: number;
  hud: HudView;
  toast: { text: string; id: number } | null;
  touchMode: TouchMode;
  sawTouch: boolean;
  coarse: boolean;
  status: Status;
  coach: boolean;
  openPause: (view?: PauseView) => void;
  setMissions: (m: MissionState) => void;
  setAim: (a: Aim) => void;
  setSound: (v: boolean) => void;
  setReward: (r: RewardCopy | null) => void;
  setPendingReward: (r: RewardCopy | null) => void;
  noteRevealed: (id: string) => void;
  replayMissions: () => void;
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
export const SOUND_KEY = "dotanv-explore-sound";

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
  missions: DEFAULT_MISSIONS,
  aim: null,
  sound: true,
  reward: null,
  pendingReward: null,
  revealed: [],
  epoch: 0,
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
  setMissions: (m) => {
    writeStorage(MISSIONS_KEY, JSON.stringify(m));
    set({ missions: m });
  },
  setAim: (a) => {
    const cur = get().aim;
    if (cur?.slug === a?.slug && cur?.name === a?.name) return;
    set({ aim: a });
  },
  setSound: (v) => {
    writeStorage(SOUND_KEY, v ? "1" : "0");
    set({ sound: v });
  },
  setReward: (r) => set({ reward: r }),
  setPendingReward: (r) => set({ pendingReward: r }),
  noteRevealed: (id) => {
    const revealed = get().revealed;
    if (!revealed.includes(id)) set({ revealed: [...revealed, id] });
  },
  replayMissions: () => {
    const next = applyEvent(get().missions, { type: "replay" }).state;
    writeStorage(MISSIONS_KEY, JSON.stringify(next));
    missionRefs.pillar = null;
    set((s) => ({
      missions: next,
      revealed: [],
      reward: null,
      pendingReward: null,
      aim: null,
      epoch: s.epoch + 1,
    }));
  },
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
