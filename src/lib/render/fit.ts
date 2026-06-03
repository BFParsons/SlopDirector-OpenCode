/**
 * Shared frame geometry — fit/cover, Ken-Burns pan-zoom, and nine-grid anchor.
 * Used by BOTH the Canvas2D renderer (`draw.ts`) and the WebGL/PixiJS renderer
 * so the math has a single source of truth (and the two stay pixel-aligned).
 */
import type { Motion, Position } from "./spec";

/** Fit fully inside w×h, centered (letterbox). */
export function contain(iw: number, ih: number, w: number, h: number) {
  const s = Math.min(w / iw, h / ih);
  const dw = iw * s,
    dh = ih * s;
  return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

/** Fill w×h, cropping the overflow. */
export function cover(iw: number, ih: number, w: number, h: number) {
  const s = Math.max(w / iw, h / ih);
  return { dw: iw * s, dh: ih * s };
}

/** Pan/scan/zoom rect for an image still at normalized progress p (0..1). */
export function kenBurns(motion: Motion, p: number, iw: number, ih: number, w: number, h: number) {
  const subtle = motion === "SUBTLE_ZOOM_IN" || motion === "SUBTLE_ZOOM_OUT";
  let z = 1,
    px: number | null = null,
    py: number | null = null;
  switch (motion) {
    case "ZOOM_IN":
      z = 1 + 0.15 * p;
      break;
    case "ZOOM_OUT":
      z = 1.15 - 0.15 * p;
      break;
    case "SUBTLE_ZOOM_IN":
      z = 1 + 0.04 * p;
      break;
    case "SUBTLE_ZOOM_OUT":
      z = 1.04 - 0.04 * p;
      break;
    case "PAN_RIGHT":
      z = 1.2;
      px = p;
      break;
    case "PAN_LEFT":
      z = 1.2;
      px = 1 - p;
      break;
    case "PAN_DOWN":
      z = 1.2;
      py = p;
      break;
    case "PAN_UP":
      z = 1.2;
      py = 1 - p;
      break;
    default:
      break;
  }
  if (subtle) {
    const c = contain(iw, ih, w, h);
    const dw = c.dw * z,
      dh = c.dh * z;
    return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
  }
  const cv = cover(iw, ih, w, h);
  const dw = cv.dw * z,
    dh = cv.dh * z;
  const dx = px != null ? -(dw - w) * px : -(dw - w) / 2;
  const dy = py != null ? -(dh - h) * py : -(dh - h) / 2;
  return { dx, dy, dw, dh };
}

/** Nine-grid anchor for an ow×oh box with margin m (text / watermark). */
export function posXY(position: Position, m: number, w: number, h: number, ow: number, oh: number) {
  const top = position.startsWith("TOP"),
    bottom = position.startsWith("BOTTOM");
  const left = position.endsWith("LEFT"),
    right = position.endsWith("RIGHT");
  const x = left ? m : right ? w - ow - m : (w - ow) / 2;
  const y = top ? m : bottom ? h - oh - m : (h - oh) / 2;
  return { x, y };
}
