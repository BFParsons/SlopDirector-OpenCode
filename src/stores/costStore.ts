"use client";

import { create } from "zustand";

interface CostState {
  /** Estimated cost (cents) of the project currently open, or null on other pages. */
  cents: number | null;
  setCents: (cents: number | null) => void;
}

/** Publishes the open project's running cost so the global header can show it. */
export const useCostStore = create<CostState>((set) => ({
  cents: null,
  setCents: (cents) => set({ cents }),
}));
