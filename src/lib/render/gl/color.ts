/**
 * Port of the Canvas2D look grade (draw.ts `colorFilter`) to a PixiJS
 * ColorMatrixFilter. The Canvas2D preview was always an approximation of the
 * ffmpeg export; this keeps the GL preview in the same ballpark using only the
 * well-behaved ColorMatrixFilter ops (brightness/contrast/saturate/hue/B&W).
 */
import type { ColorMatrixFilter } from "pixi.js";
import type { ColorLook } from "../spec";

type Adjust = { brightness: number; contrast: number; saturation: number };

/**
 * Configure `cm` for the given look + per-clip adjust. Returns false when the
 * result is identity (no adjust + NONE look) so the caller can drop the filter
 * and skip an extra render pass.
 */
export function applyColorMatrix(cm: ColorMatrixFilter, look: ColorLook, adj: Adjust): boolean {
  cm.reset();
  let active = look !== "NONE";
  // Per-clip adjust (brightness delta, contrast/saturation multipliers).
  if (adj.brightness !== 0) {
    cm.brightness(1 + adj.brightness, true);
    active = true;
  }
  if (adj.contrast !== 1) {
    cm.contrast(adj.contrast - 1, true);
    active = true;
  }
  if (adj.saturation !== 1) {
    cm.saturate(adj.saturation - 1, true);
    active = true;
  }
  // Look preset (mirrors the CSS-filter looks; sepia tints approximated via hue).
  switch (look) {
    case "WARM":
      cm.saturate(0.08, true);
      cm.hue(8, true);
      break;
    case "COOL":
      cm.saturate(-0.08, true);
      cm.hue(-12, true);
      break;
    case "BW":
      cm.blackAndWhite(true);
      cm.contrast(0.08, true);
      break;
    case "VINTAGE":
      cm.saturate(-0.15, true);
      cm.contrast(-0.04, true);
      cm.hue(15, true);
      break;
    case "PUNCH":
      cm.contrast(0.18, true);
      cm.saturate(0.25, true);
      break;
    case "TEAL_ORANGE":
      cm.saturate(0.12, true);
      cm.contrast(0.08, true);
      cm.hue(-6, true);
      break;
    case "NOIR":
      cm.blackAndWhite(true);
      cm.contrast(0.35, true);
      cm.brightness(0.95, true);
      break;
    case "CAMPAIGN":
      cm.saturate(0.1, true);
      cm.brightness(1.03, true);
      cm.contrast(0.05, true);
      cm.hue(6, true);
      break;
    case "BLEACH":
      cm.saturate(-0.45, true);
      cm.contrast(0.3, true);
      cm.brightness(0.97, true);
      break;
    default:
      break;
  }
  return active;
}
