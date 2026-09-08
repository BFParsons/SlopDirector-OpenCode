import { panelMin } from "@/config/panel-min-sizes";
import type { WorkspaceLayoutData } from "@/types/window";

/** The one saved workspace that can never be deleted — it's the user's
 *  permanent fallback. Protection is enforced in the SaveMenu (no ✕) and in the
 *  DELETE route. Matched by exact name. */
export const PROTECTED_LAYOUT_NAME = "Default Workspace";

/**
 * System default Studio arrangement — the startup workspace when a user opens a
 * project: the **Program Monitor** across the top of the main area, the
 * **Timeline** below it, and the **Media Bucket** as a full-height column on
 * the right. (Chosen by the user on 2026-09-08 as the standard startup
 * workspace; other panels are a click away in "+ Panel".)
 *
 * Computed from the live workspace size (`cw`×`ch`) so the same arrangement fits
 * any display — from a 1080p laptop at 2× scale (~936×448 workspace) up to a
 * wide monitor — instead of fixed pixels tuned for one screen. The bucket column
 * and the rows never shrink below their panels' minimums (the main area takes
 * the remainder), so nothing renders off-screen. The `sys-*` ids are stable so a
 * seeded default can be recognised later.
 */
export function systemDefaultLayout(cw: number, ch: number): WorkspaceLayoutData {
  const g = 8; // gutter
  const bucketW = Math.max(Math.round(cw * 0.28), panelMin("media-bucket").width);
  const mainW = Math.max(cw - g * 3 - bucketW, panelMin("monitor").width, panelMin("timeline").width);
  const bucketX = g + mainW + g;
  const monitorH = Math.max(Math.round(ch * 0.58), panelMin("monitor").height);
  const timelineY = g + monitorH + g;
  const timelineH = Math.max(ch - timelineY - g, panelMin("timeline").height);
  const fullH = Math.max(ch - g * 2, panelMin("media-bucket").height);

  const win = (
    id: string,
    panelType: WorkspaceLayoutData["windows"][number]["panelType"],
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
    zIndex: number,
  ) => ({ id, panelType, title, position: { x, y }, size: { width, height }, zIndex, isMinimized: false, isMaximized: false });

  return {
    version: 2,
    nextZIndex: 4,
    container: { width: cw, height: ch },
    windows: [
      win("sys-monitor", "monitor", "Program Monitor", g, g, mainW, monitorH, 3),
      win("sys-timeline", "timeline", "Timeline", g, timelineY, mainW, timelineH, 2),
      win("sys-bucket", "media-bucket", "Media Bucket", bucketX, g, bucketW, fullH, 1),
    ],
  };
}
