"use client";

import { create } from "zustand";
import type { Mode } from "@/types";

type AppState = {
  mode: Mode;
  setMode: (m: Mode) => void;
  activeMarker: string | null;
  setActiveMarker: (slug: string | null) => void;
};

export const useApp = create<AppState>((set) => ({
  mode: "clean",
  setMode: (m) => set({ mode: m }),
  activeMarker: null,
  setActiveMarker: (slug) => set({ activeMarker: slug }),
}));
