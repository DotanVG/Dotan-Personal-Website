"use client";

import { create } from "zustand";
import type { Mode } from "@/types";

type AppState = {
  mode: Mode;
  setMode: (m: Mode) => void;
};

export const useApp = create<AppState>((set) => ({
  mode: "clean",
  setMode: (m) => set({ mode: m }),
}));
