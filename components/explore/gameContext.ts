"use client";

import { createContext, useContext, useEffect, useRef, type MutableRefObject } from "react";
import type * as THREE from "three";
import type { InputState } from "@/lib/game/input";
import type { Game, GameEvent } from "@/lib/game/sim";

import type { Quality } from "./quality";

export type { Quality };

/** Per-frame data handed to every registered frame callback, in order. */
export type FrameCtx = {
  g: Game;
  /** Interpolation factor between the previous and current fixed step. */
  alpha: number;
  /** Real frame time (s), capped. */
  dt: number;
  camera: THREE.PerspectiveCamera;
  events: readonly GameEvent[];
  reduced: boolean;
  paused: boolean;
};

type Entry = { order: number; fn: (c: FrameCtx) => void };

export function createFrameBus() {
  const list: Entry[] = [];
  return {
    add(order: number, fn: (c: FrameCtx) => void) {
      const e = { order, fn };
      list.push(e);
      list.sort((a, b) => a.order - b.order);
      return () => {
        const i = list.indexOf(e);
        if (i >= 0) list.splice(i, 1);
      };
    },
    run(c: FrameCtx) {
      for (const e of list) e.fn(c);
    },
  };
}

export type FrameBus = ReturnType<typeof createFrameBus>;

/** Camera yaw shared with the simulation for camera-relative walking. */
export type CameraShared = { yaw: number; /** Test hook: snap the camera to this yaw once. */ aimYaw: number | null };

export type GameContextValue = {
  gameRef: MutableRefObject<Game>;
  input: InputState;
  bus: FrameBus;
  cam: CameraShared;
  quality: Quality;
  reduced: boolean;
  pausedRef: MutableRefObject<boolean>;
};

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const v = useContext(GameContext);
  if (!v) throw new Error("useGame outside GameContext");
  return v;
}

/** Register a callback on the ordered game frame (lower `order` runs first). */
export function useGameFrame(fn: (c: FrameCtx) => void, order = 0) {
  const { bus } = useGame();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => bus.add(order, (c) => ref.current(c)), [bus, order]);
}

export const FRAME_ORDER = {
  views: 10,
  camera: 20,
  effects: 30,
  hud: 40,
} as const;
