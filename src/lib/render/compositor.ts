/**
 * A pluggable preview renderer. `usePreviewEngine` drives it (rAF clock, seeking,
 * audio); the impl decides HOW each frame is painted. The WebGL (PixiJS) compositor
 * is the default — it previews every effect live and is GPU-accelerated. Canvas2D
 * remains the automatic fallback (GLCompositor degrades to it on init failure or
 * while booting) and an explicit opt-out via `?gl=0` / `localStorage.slop_gl="0"`.
 *
 * `render` receives the live canvas each frame so the compositor stays resilient
 * to the monitor remounting. The GL impl draws via an offscreen WebGL canvas and
 * composites onto the visible 2D canvas, so the visible canvas is always 2D.
 */
import { Canvas2DCompositor } from "./canvas2dCompositor";
import type { MediaCache } from "./draw";
import { GLCompositor } from "./gl/GLCompositor";
import type { RenderSpec } from "./spec";

export interface Compositor {
  render(canvas: HTMLCanvasElement, spec: RenderSpec, t: number, cache: MediaCache): void;
  destroy(): void;
  readonly kind: "canvas2d" | "gl";
}

/** WebGL is the default; opt out with `?gl=0` (or `localStorage.slop_gl="0"`). */
function glEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URL(window.location.href).searchParams.get("gl");
    if (q === "0") return false;
    if (q === "1") return true;
    return window.localStorage.getItem("slop_gl") !== "0";
  } catch {
    return true;
  }
}

export function pickCompositor(): Compositor {
  // PixiJS is dynamically imported inside GLCompositor.boot(), so opting out
  // (Canvas2D) never loads it.
  if (glEnabled()) return new GLCompositor();
  return new Canvas2DCompositor();
}
