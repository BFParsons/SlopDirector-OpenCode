/**
 * Safe areas: where text and graphics may sit so that no delivery platform
 * cuts them off or covers them. Everything that places text — the ffmpeg
 * render (drawtext, libass captions), the browser preview (canvas) and the
 * mechanical checks — anchors to the same rectangles from here.
 *
 *   action-safe  — nothing important outside it (overscan, crops)
 *   title-safe   — all text inside it (readable on every screen and under
 *                  every platform's own UI)
 *
 * Profiles (insets as fractions of the frame):
 *   web        16:9 and other landscape for the web: action 5 %, title 10 %
 *   broadcast  SMPTE ST 2046-1 for HD: action 93 % (3.5 %), title 90 % (5 %)
 *   social     9:16 vertical for TikTok / Reels / Shorts: the platform draws
 *              its UI over the frame — a caption block at the bottom, an
 *              icon rail on the right, the status bar on top. action: top 8,
 *              bottom 12, left 5, right 5; title: top 14, bottom 22, left 6,
 *              right 17.
 *   square     1:1 feeds: action 5 %, title 10 %
 *   none       no insets (a deliberate choice, e.g. a full-bleed card)
 *   auto       by aspect: < 0.8 → social · ≈ 1 → square · else web
 */
export type SafeProfile = "auto" | "web" | "broadcast" | "social" | "square" | "none";
export const SAFE_PROFILES: SafeProfile[] = ["auto", "web", "broadcast", "social", "square", "none"];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Insets = { top: number; bottom: number; left: number; right: number };
export interface SafeAreas {
  profile: Exclude<SafeProfile, "auto">;
  width: number;
  height: number;
  action: Rect;
  title: Rect;
  /** one line for a report */
  note: string;
}

const INSETS: Record<Exclude<SafeProfile, "auto">, { action: Insets; title: Insets; note: string }> = {
  web: { action: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 }, title: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 }, note: "web 16:9 — action 5 %, title 10 %" },
  broadcast: { action: { top: 0.035, bottom: 0.035, left: 0.035, right: 0.035 }, title: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 }, note: "broadcast (SMPTE ST 2046-1) — action 93 %, title 90 %" },
  social: { action: { top: 0.08, bottom: 0.12, left: 0.05, right: 0.05 }, title: { top: 0.14, bottom: 0.22, left: 0.06, right: 0.17 }, note: "social 9:16 — the platform's caption block (bottom 22 %), icon rail (right 17 %) and status bar (top 14 %) are outside title-safe" },
  square: { action: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 }, title: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 }, note: "square 1:1 — action 5 %, title 10 %" },
  none: { action: { top: 0, bottom: 0, left: 0, right: 0 }, title: { top: 0, bottom: 0, left: 0, right: 0 }, note: "no safe area (full bleed by choice)" },
};

export function resolveProfile(width: number, height: number, profile: SafeProfile | string | null | undefined): Exclude<SafeProfile, "auto"> {
  const p = (profile ?? "auto") as SafeProfile;
  if (p !== "auto" && p in INSETS) return p as Exclude<SafeProfile, "auto">;
  const aspect = width / Math.max(1, height);
  if (aspect < 0.8) return "social";
  if (Math.abs(aspect - 1) < 0.1) return "square";
  return "web";
}

const rect = (w: number, h: number, i: Insets): Rect => {
  const x = Math.round(w * i.left);
  const y = Math.round(h * i.top);
  return { x, y, w: Math.round(w * (1 - i.left - i.right)), h: Math.round(h * (1 - i.top - i.bottom)) };
};

export function safeAreas(width: number, height: number, profile?: SafeProfile | string | null): SafeAreas {
  const p = resolveProfile(width, height, profile);
  const d = INSETS[p];
  return { profile: p, width, height, action: rect(width, height, d.action), title: rect(width, height, d.title), note: d.note };
}

export const contains = (outer: Rect, inner: Rect, tol = 0.5) => inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.x + inner.w <= outer.x + outer.w + tol && inner.y + inner.h <= outer.y + outer.h + tol;

/** How far (px) a box sticks out of a rect on each side (0 when inside). */
export function overflow(outer: Rect, inner: Rect) {
  return {
    left: Math.max(0, outer.x - inner.x),
    top: Math.max(0, outer.y - inner.y),
    right: Math.max(0, inner.x + inner.w - (outer.x + outer.w)),
    bottom: Math.max(0, inner.y + inner.h - (outer.y + outer.h)),
  };
}
