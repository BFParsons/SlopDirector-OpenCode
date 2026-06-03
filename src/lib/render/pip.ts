/**
 * Picture-in-picture placement for an overlay-track (V2) clip: where the clip
 * sits over the V1 base. Premiere-style **center-based** model so it works at any
 * scale and can spill off-frame:
 *   - `scale` = width as a fraction of the frame width — de-clamped up to 4× (may
 *     exceed the frame);
 *   - `posX`/`posY` = the CENTER of the PiP box as a fraction of the frame
 *     (0.5 = centered, 0 = center at the left/top edge, 1 = right/bottom edge),
 *     de-clamped so the box can bleed off-frame;
 *   - `opacity` 0..1.
 * Shared by the canvas preview (`draw.ts` drawOverlay) and the ffmpeg overlay
 * export (`assemble.ts`) — keep the two in sync.
 */
export interface PipPlacement {
  scale: number;
  posX: number;
  posY: number;
  opacity: number;
}

export const DEFAULT_PIP: PipPlacement = { scale: 0.32, posX: 0.8, posY: 0.8, opacity: 1 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Tolerant coercion of the JSON column into a PipPlacement (with defaults). */
export function asPip(raw: unknown): PipPlacement {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PIP };
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    scale: clamp(num(r.scale, DEFAULT_PIP.scale), 0.02, 4),
    posX: clamp(num(r.posX, DEFAULT_PIP.posX), -0.5, 1.5),
    posY: clamp(num(r.posY, DEFAULT_PIP.posY), -0.5, 1.5),
    opacity: clamp(num(r.opacity, DEFAULT_PIP.opacity), 0, 1),
  };
}
