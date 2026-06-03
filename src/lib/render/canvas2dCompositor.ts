import type { Compositor } from "./compositor";
import { type MediaCache, drawFrame } from "./draw";
import type { RenderSpec } from "./spec";

/** The original Canvas2D compositor — the default, and the WebGL fallback. */
export class Canvas2DCompositor implements Compositor {
  readonly kind = "canvas2d" as const;

  render(canvas: HTMLCanvasElement, spec: RenderSpec, t: number, cache: MediaCache): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, spec, t, cache);
  }

  destroy(): void {
    /* no GPU resources to free */
  }
}
