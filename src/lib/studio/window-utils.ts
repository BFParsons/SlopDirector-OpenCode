import type { PanelType } from "@/types/panel";
import type { WindowState } from "@/types/window";

export const CASCADE_OFFSET = 50;
export const DEFAULT_WIDTH = 600;
export const DEFAULT_HEIGHT = 450;

let windowCounter = 0;

export function genWindowId(): string {
  // Date.now() is unavailable in some sandboxed contexts but fine in the browser
  // where the Studio runs; the counter guarantees uniqueness within a session.
  return `win-${Date.now()}-${++windowCounter}`;
}

export function makeWindow(
  panelType: PanelType,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
): WindowState {
  return {
    id: genWindowId(),
    panelType,
    title,
    position: { x, y },
    size: { width: w, height: h },
    zIndex: z,
    isMinimized: false,
    isMaximized: false,
  };
}
