"use client";

import { create } from "zustand";
import type { Mode } from "@/types";

type AppState = {
  mode: Mode;
  setMode: (m: Mode) => void;
  hasEnteredExplore: boolean;
  markEnteredExplore: () => void;
  activeMarker: string | null;
  setActiveMarker: (slug: string | null) => void;
};

export const useApp = create<AppState>((set) => ({
  mode: "clean",
  setMode: (m) => set({ mode: m }),
  hasEnteredExplore: false,
  markEnteredExplore: () => set({ hasEnteredExplore: true }),
  activeMarker: null,
  setActiveMarker: (slug) => set({ activeMarker: slug }),
}));
