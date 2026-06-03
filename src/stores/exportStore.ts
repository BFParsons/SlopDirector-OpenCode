"use client";

import { create } from "zustand";

/**
 * Drives the floating Export window. It lives in a module store (not editor
 * state) so it survives the workspace's keyed remount — the render the export
 * triggers bumps `updatedAt`, which remounts StudioRoot; the window must outlast
 * that, so it's rendered above the key (ProjectWorkspace) and controlled here.
 */
interface ExportState {
  projectId: string | null;
  open: (projectId: string) => void;
  close: () => void;
}

export const useExportStore = create<ExportState>((set) => ({
  projectId: null,
  open: (projectId) => set({ projectId }),
  close: () => set({ projectId: null }),
}));
