import { panelMin } from "@/config/panel-min-sizes";
import type { PanelType } from "@/types/panel";
import type { WindowState, WorkspaceLayoutData } from "@/types/window";

export const CASCADE_OFFSET = 50;
export const DEFAULT_WIDTH = 600;
export const DEFAULT_HEIGHT = 450;
/** Breathing room kept between a fitted window and the workspace edge. */
export const FIT_PAD = 8;

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

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Make a layout fit a `cw`×`ch` workspace so every panel is on screen.
 *
 * 1. If the layout records the container it was authored at (`container`) and
 *    that differs from the current one, scale every window's position and size
 *    proportionally — a layout saved on a 1366×776 workspace opens on a 936×411
 *    one (a 1080p laptop at 2× scale) as the same arrangement, just smaller,
 *    and grows back when opened on a big monitor again.
 * 2. Then clamp: no window larger than the workspace (minus `FIT_PAD`) nor
 *    smaller than its panel minimum (`panel-min-sizes`), and no window
 *    positioned past the workspace edges. Maximized windows track the
 *    workspace. (If a minimum alone exceeds the workspace the window is
 *    pinned at 0 and overflows — unavoidable, but never hidden.)
 *
 * The result is stamped with the current `container`. An unmeasured container
 * (< 2px) returns the input untouched.
 */
export function fitLayoutToContainer(
  data: WorkspaceLayoutData,
  cw: number,
  ch: number,
): WorkspaceLayoutData {
  if (!(cw >= 2 && ch >= 2)) return data;
  const from = data.container;
  const scale = from && from.width >= 2 && from.height >= 2 && (from.width !== cw || from.height !== ch);
  const sx = scale ? cw / from.width : 1;
  const sy = scale ? ch / from.height : 1;

  const fit = (type: PanelType, position: { x: number; y: number }, size: { width: number; height: number }) => {
    const min = panelMin(type);
    const width = clamp(Math.round(size.width * sx), min.width, cw - FIT_PAD * 2);
    const height = clamp(Math.round(size.height * sy), min.height, ch - FIT_PAD * 2);
    const x = clamp(Math.round(position.x * sx), 0, cw - width);
    const y = clamp(Math.round(position.y * sy), 0, ch - height);
    return { position: { x, y }, size: { width, height } };
  };

  const windows = data.windows.map((w) => {
    if (w.isMaximized) {
      return {
        ...w,
        position: { x: 0, y: 0 },
        size: { width: cw, height: ch },
        preMaximizeState: w.preMaximizeState
          ? fit(w.panelType, w.preMaximizeState.position, w.preMaximizeState.size)
          : undefined,
      };
    }
    return { ...w, ...fit(w.panelType, w.position, w.size) };
  });

  return { ...data, windows, container: { width: cw, height: ch } };
}
