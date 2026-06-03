"use client";

import { create } from "zustand";
import { withBase } from "@/lib/basePath";
import { PRESETS, SECTION_PRESETS, panelSection, type WorkspaceSection } from "@/config/studio-presets";
import { SYSTEM_DEFAULT_LAYOUT } from "@/config/studio-default-layout";
import { CASCADE_OFFSET, DEFAULT_HEIGHT, DEFAULT_WIDTH, genWindowId } from "@/lib/studio/window-utils";
import type { PanelType } from "@/types/panel";
import type { WindowState, WorkspaceLayoutData } from "@/types/window";

const LAYOUT_URL = "/api/workspace/layout";

function createDefaultLayout(): WorkspaceLayoutData {
  return {
    version: 2,
    nextZIndex: SYSTEM_DEFAULT_LAYOUT.nextZIndex,
    // Fresh copies so window operations never mutate the shared constant.
    windows: SYSTEM_DEFAULT_LAYOUT.windows.map((w) => ({ ...w, position: { ...w.position }, size: { ...w.size } })),
  };
}

/** The hardcoded default arrangement for a section, fit to the container. Audio
 *  is the fixed `audio-studio` preset; video is the system Premiere-style layout. */
function sectionDefault(section: WorkspaceSection, cw: number, ch: number): WorkspaceLayoutData {
  if (section === "audio") return PRESETS["audio-studio"](cw, ch);
  return createDefaultLayout();
}

/** Drop windows that don't belong to this section, so a saved layout that mixed
 *  Audio + Video panels can't bleed across suites. Falls back to the section
 *  default if nothing relevant remains. */
function sanitizeForSection(
  data: WorkspaceLayoutData,
  section: WorkspaceSection,
  cw: number,
  ch: number,
): WorkspaceLayoutData {
  const windows = data.windows.filter((w) => panelSection(w.panelType) === section);
  if (windows.length === 0) return sectionDefault(section, cw, ch);
  return { version: 2, windows, nextZIndex: data.nextZIndex };
}

function applyLayoutData(
  data: WorkspaceLayoutData,
  set: (state: Partial<WorkspaceState>) => void,
  extra?: { layoutId?: string; currentLayoutName?: string; isDirty?: boolean },
) {
  set({
    windows: data.windows,
    nextZIndex: data.nextZIndex,
    layoutId: extra?.layoutId ?? null,
    currentLayoutName: extra?.currentLayoutName ?? null,
    isDirty: extra?.isDirty ?? false,
    isReady: true,
  });
}

interface SavedLayoutMeta {
  id: string;
  name: string;
  isDefault: boolean;
  updatedAt: string;
}

interface WorkspaceState {
  windows: WindowState[];
  nextZIndex: number;
  layoutId: string | null;
  currentLayoutName: string | null;
  isDirty: boolean;
  containerSize: { width: number; height: number };
  isReady: boolean;
  savedLayouts: SavedLayoutMeta[];
  /** Which suite this workspace is showing — keeps Audio & Video discrete. */
  section: WorkspaceSection;

  // Window operations
  addWindow: (panelType: PanelType, title: string) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  updateWindowSize: (id: string, width: number, height: number) => void;
  resetWindowPosition: (id: string) => void;
  arrangeWindows: () => void;

  // Layout operations
  enterSection: (section: WorkspaceSection) => Promise<void>;
  applyPreset: (preset: string) => void;
  getPresetNames: () => string[];
  saveLayout: () => Promise<void>;
  loadLayout: () => Promise<void>;
  loadSavedLayouts: () => Promise<void>;
  saveLayoutAs: (name: string, makeDefault?: boolean) => Promise<void>;
  deleteLayout: (id: string) => Promise<void>;
  setDefaultLayout: (id: string) => Promise<void>;
  loadLayoutById: (id: string) => Promise<void>;
  resetLayout: () => void;
  setDirty: (dirty: boolean) => void;
  setContainerSize: (width: number, height: number) => void;
  toLayoutData: () => WorkspaceLayoutData;
}

async function putLayout(body: unknown): Promise<{ id: string; name: string } | null> {
  const res = await fetch(withBase(LAYOUT_URL), {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Requested-With": "spotforge" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as { data?: { id: string; name: string } } | null;
  return json?.data ?? null;
}

export const useStudioWorkspaceStore = create<WorkspaceState>((set, get) => ({
  windows: [],
  nextZIndex: 1,
  layoutId: null,
  currentLayoutName: null,
  isDirty: false,
  containerSize: { width: 0, height: 0 }, // set by the ResizeObserver before first paint
  isReady: false,
  savedLayouts: [],
  section: "video",

  addWindow: (panelType, title) => {
    const { windows, nextZIndex, containerSize } = get();
    const offset = (windows.length % 10) * CASCADE_OFFSET;
    const win: WindowState = {
      id: genWindowId(),
      panelType,
      title,
      position: {
        x: Math.max(0, Math.min(40 + offset, containerSize.width - DEFAULT_WIDTH)),
        y: Math.max(0, Math.min(40 + offset, containerSize.height - DEFAULT_HEIGHT)),
      },
      size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      zIndex: nextZIndex,
      isMinimized: false,
      isMaximized: false,
    };
    set({ windows: [...windows, win], nextZIndex: nextZIndex + 1, isDirty: true });
  },

  closeWindow: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id), isDirty: true })),

  minimizeWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)),
      isDirty: true,
    })),

  maximizeWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              isMaximized: true,
              preMaximizeState: { position: { ...w.position }, size: { ...w.size } },
              position: { x: 0, y: 0 },
              size: { width: s.containerSize.width, height: s.containerSize.height },
              zIndex: s.nextZIndex,
            }
          : w,
      ),
      nextZIndex: s.nextZIndex + 1,
      isDirty: true,
    })),

  restoreWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.isMinimized) return { ...w, isMinimized: false, zIndex: s.nextZIndex };
        if (w.isMaximized && w.preMaximizeState) {
          return {
            ...w,
            isMaximized: false,
            position: { ...w.preMaximizeState.position },
            size: { ...w.preMaximizeState.size },
            preMaximizeState: undefined,
            zIndex: s.nextZIndex,
          };
        }
        return { ...w, zIndex: s.nextZIndex };
      }),
      nextZIndex: s.nextZIndex + 1,
      isDirty: true,
    })),

  bringToFront: (id) => {
    const { windows, nextZIndex } = get();
    const win = windows.find((w) => w.id === id);
    if (!win || win.zIndex === nextZIndex - 1) return;
    set({
      windows: windows.map((w) => (w.id === id ? { ...w, zIndex: nextZIndex } : w)),
      nextZIndex: nextZIndex + 1,
    });
  },

  updateWindowPosition: (id, x, y) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, position: { x, y } } : w)),
      isDirty: true,
    })),

  updateWindowSize: (id, width, height) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, size: { width, height } } : w)),
      isDirty: true,
    })),

  resetWindowPosition: (id) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      if (!win) return s;
      const { containerSize, nextZIndex } = s;
      const x = Math.max(0, Math.round((containerSize.width - win.size.width) / 2));
      const y = Math.max(0, Math.round((containerSize.height - win.size.height) / 2));
      return {
        windows: s.windows.map((w) =>
          w.id === id
            ? { ...w, position: { x, y }, isMinimized: false, isMaximized: false, preMaximizeState: undefined, zIndex: nextZIndex }
            : w,
        ),
        nextZIndex: nextZIndex + 1,
        isDirty: true,
      };
    }),

  arrangeWindows: () =>
    set((s) => {
      const visible = s.windows.filter((w) => !w.isMinimized);
      if (visible.length === 0) return s;
      const { containerSize } = s;
      const gap = 6;
      const count = visible.length;
      let cols = Math.ceil(Math.sqrt(count * (containerSize.width / containerSize.height)));
      let rows = Math.ceil(count / cols);
      if (rows > 1 && count <= (cols - 1) * rows) {
        cols = cols - 1;
        rows = Math.ceil(count / cols);
      }
      const cellW = Math.floor((containerSize.width - gap * (cols + 1)) / cols);
      const cellH = Math.floor((containerSize.height - gap * (rows + 1)) / rows);
      const arranged = s.windows.map((w) => {
        const idx = visible.indexOf(w);
        if (idx === -1) return w;
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
          ...w,
          position: { x: gap + col * (cellW + gap), y: gap + row * (cellH + gap) },
          size: { width: cellW, height: cellH },
          isMaximized: false,
          preMaximizeState: undefined,
          zIndex: s.nextZIndex + idx,
        };
      });
      return { windows: arranged, nextZIndex: s.nextZIndex + visible.length, isDirty: true };
    }),

  enterSection: async (section) => {
    // Already showing this section's layout — keep it (don't clobber on remount).
    if (get().section === section && get().isReady) return;
    const { containerSize } = get();
    set({ section, isReady: false, isDirty: false });
    if (section === "audio") {
      // Hardcoded default — never loaded from / saved to the DB.
      const data = sectionDefault("audio", containerSize.width, containerSize.height);
      set({
        windows: data.windows,
        nextZIndex: data.nextZIndex,
        layoutId: null,
        currentLayoutName: "Audio Studio",
        savedLayouts: [],
        isReady: true,
        isDirty: false,
      });
      return;
    }
    await get().loadLayout(); // video: the user's saved/default layout
  },

  applyPreset: (preset) => {
    const { containerSize } = get();
    const factory = PRESETS[preset];
    if (!factory) return;
    const data = factory(containerSize.width, containerSize.height);
    set({ windows: data.windows, nextZIndex: data.nextZIndex, isDirty: true });
  },

  getPresetNames: () => (SECTION_PRESETS[get().section] ?? []).filter((p) => p in PRESETS),

  resetLayout: () => {
    const { section, containerSize } = get();
    const data = sectionDefault(section, containerSize.width, containerSize.height);
    set({ windows: data.windows, nextZIndex: data.nextZIndex, isDirty: section !== "audio" });
  },

  setDirty: (dirty) => set({ isDirty: dirty }),
  setContainerSize: (width, height) => set({ containerSize: { width, height } }),

  toLayoutData: (): WorkspaceLayoutData => {
    const { windows, nextZIndex } = get();
    return { version: 2, windows, nextZIndex };
  },

  saveLayout: async () => {
    if (get().section === "audio") return; // Audio Studio uses a hardcoded default
    const { layoutId } = get();
    const layout = get().toLayoutData();
    // Update the current workspace in place (preserve its default flag). The very
    // first save (no row yet) seeds the default. Only invoked on an explicit Save,
    // so it must NOT silently re-mark a non-default workspace as default.
    const data = await putLayout(
      layoutId ? { id: layoutId, layout } : { name: "Workspace", layout, isDefault: true },
    );
    if (data) {
      set({ layoutId: data.id, currentLayoutName: data.name, isDirty: false });
      get().loadSavedLayouts();
    }
  },

  loadLayout: async () => {
    try {
      const res = await fetch(withBase(LAYOUT_URL));
      if (!res.ok) {
        applyLayoutData(createDefaultLayout(), set);
        return;
      }
      const json = (await res.json()) as { data?: SavedLayoutWithData[] };
      const layouts = json.data;
      if (Array.isArray(layouts)) {
        set({
          savedLayouts: layouts.map((l) => ({ id: l.id, name: l.name, isDefault: l.isDefault, updatedAt: l.updatedAt })),
        });
        const def = layouts.find((l) => l.isDefault) ?? layouts[0];
        if (def && (def.layout as { version?: number })?.version === 2) {
          const { section, containerSize } = get();
          const data = sanitizeForSection(def.layout as WorkspaceLayoutData, section, containerSize.width, containerSize.height);
          applyLayoutData(data, set, { layoutId: def.id, currentLayoutName: def.name });
          return;
        }
      }
      // First-time user (or no usable saved layout): seed + persist the default.
      applyLayoutData(createDefaultLayout(), set);
      void get().saveLayout();
    } catch {
      applyLayoutData(createDefaultLayout(), set);
    }
  },

  loadSavedLayouts: async () => {
    try {
      const res = await fetch(withBase(LAYOUT_URL));
      if (!res.ok) return;
      const json = (await res.json()) as { data?: SavedLayoutWithData[] };
      if (Array.isArray(json.data)) {
        set({
          savedLayouts: json.data.map((l) => ({ id: l.id, name: l.name, isDefault: l.isDefault, updatedAt: l.updatedAt })),
        });
      }
    } catch {
      // Silently fail — dropdown shows stale data.
    }
  },

  saveLayoutAs: async (name, makeDefault = false) => {
    if (get().section === "audio") return; // Audio Studio uses a hardcoded default
    const layout = get().toLayoutData();
    const data = await putLayout({ name, layout, isDefault: makeDefault });
    if (data) {
      set({ layoutId: data.id, currentLayoutName: data.name, isDirty: false });
      get().loadSavedLayouts();
    }
  },

  deleteLayout: async (id) => {
    const res = await fetch(withBase(LAYOUT_URL), {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "X-Requested-With": "spotforge" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      if (get().layoutId === id) set({ layoutId: null, currentLayoutName: null });
      get().loadSavedLayouts();
    }
  },

  setDefaultLayout: async (id) => {
    const data = await putLayout({ id, isDefault: true });
    if (data) get().loadSavedLayouts();
  },

  loadLayoutById: async (id) => {
    try {
      const res = await fetch(withBase(LAYOUT_URL));
      if (!res.ok) return;
      const json = (await res.json()) as { data?: SavedLayoutWithData[] };
      const target = json.data?.find((l) => l.id === id);
      if (target && (target.layout as { version?: number })?.version === 2) {
        const { section, containerSize } = get();
        const data = sanitizeForSection(target.layout as WorkspaceLayoutData, section, containerSize.width, containerSize.height);
        applyLayoutData(data, set, { layoutId: target.id, currentLayoutName: target.name });
      }
    } catch {
      // Silently fail.
    }
  },
}));

interface SavedLayoutWithData {
  id: string;
  name: string;
  isDefault: boolean;
  updatedAt: string;
  layout: unknown;
}
