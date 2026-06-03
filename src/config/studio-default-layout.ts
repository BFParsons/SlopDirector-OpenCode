import type { WorkspaceLayoutData } from "@/types/window";

/** The one saved workspace that can never be deleted — it's the user's
 *  permanent fallback. Protection is enforced in the SaveMenu (no ✕) and in the
 *  DELETE route. Matched by exact name. */
export const PROTECTED_LAYOUT_NAME = "Default Workspace";

/**
 * System default Studio arrangement — a Premiere-style layout: a tall media/visual
 * column on the left, the program Monitor over the Timeline in the center, and the
 * finishing tools (Audio / Polish / Text) stacked on the right. Fixed pixel sizes
 * (tuned for ~1366-wide); the ResizeObserver + `bounds="parent"` keep everything
 * draggable on smaller screens, and the presets recompute to the real size.
 */
export const SYSTEM_DEFAULT_LAYOUT: WorkspaceLayoutData = {
  version: 2,
  nextZIndex: 7,
  windows: [
    { id: "sys-visual", panelType: "visual", title: "Visual / Media", position: { x: 8, y: 8 }, size: { width: 340, height: 760 }, zIndex: 1, isMinimized: false, isMaximized: false },
    { id: "sys-monitor", panelType: "monitor", title: "Program Monitor", position: { x: 356, y: 8 }, size: { width: 600, height: 400 }, zIndex: 6, isMinimized: false, isMaximized: false },
    { id: "sys-timeline", panelType: "timeline", title: "Timeline", position: { x: 356, y: 416 }, size: { width: 600, height: 352 }, zIndex: 5, isMinimized: false, isMaximized: false },
    { id: "sys-polish", panelType: "polish", title: "Polish", position: { x: 964, y: 266 }, size: { width: 360, height: 290 }, zIndex: 3, isMinimized: false, isMaximized: false },
    { id: "sys-text", panelType: "text-overlays", title: "Text Overlays", position: { x: 964, y: 564 }, size: { width: 360, height: 204 }, zIndex: 4, isMinimized: false, isMaximized: false },
  ],
};
