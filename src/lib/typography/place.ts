/**
 * Anchor a box inside a rectangle (the title-safe area) from a 9-grid
 * position plus an inset. Two flavours of the same arithmetic: numbers for
 * the canvas preview and the checks, expression strings for ffmpeg's
 * drawtext / overlay (whose box size is a runtime token such as text_w).
 */
import type { Rect } from "./safe";

export type Anchor = "TOP_LEFT" | "TOP_CENTER" | "TOP_RIGHT" | "MIDDLE_LEFT" | "CENTER" | "MIDDLE_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_CENTER" | "BOTTOM_RIGHT";

const parts = (position: string) => ({
  top: position.startsWith("TOP"),
  bottom: position.startsWith("BOTTOM"),
  left: position.endsWith("LEFT"),
  right: position.endsWith("RIGHT"),
});

/** Numeric placement: the box's top-left corner. */
export function anchorNum(position: string, rect: Rect, inset: number, objW: number, objH: number): { x: number; y: number } {
  const m = Math.max(0, inset);
  const { top, bottom, left, right } = parts(position);
  const x = left ? rect.x + m : right ? rect.x + rect.w - objW - m : rect.x + (rect.w - objW) / 2;
  const y = top ? rect.y + m : bottom ? rect.y + rect.h - objH - m : rect.y + (rect.h - objH) / 2;
  return { x: Math.round(x), y: Math.round(y) };
}

/** ffmpeg expressions: objW / objH are the filter's own tokens (text_w / w …). */
export function anchorExpr(position: string, rect: Rect, inset: number, objW: string, objH: string): { x: string; y: string } {
  const m = Math.max(0, Math.round(inset));
  const { top, bottom, left, right } = parts(position);
  const x = left ? `${rect.x + m}` : right ? `${rect.x + rect.w - m}-${objW}` : `${rect.x}+(${rect.w}-${objW})/2`;
  const y = top ? `${rect.y + m}` : bottom ? `${rect.y + rect.h - m}-${objH}` : `${rect.y}+(${rect.h}-${objH})/2`;
  return { x, y };
}
