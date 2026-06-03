/**
 * Effect registry: one entry per effect, pairing the UI params with the ffmpeg
 * filter (export) and the preview capability, so preview and export stay in sync
 * by construction. Consumed by `assemble.ts` (export), `draw.ts` (preview), and
 * `EffectControlsPanel` (UI). See `src/lib/render/effects.ts` for the data shape.
 */
import type { EffectKind, EffectSpec } from "@/lib/render/effects";

export type ParamType = "range" | "color" | "select";

export interface EffectParamDef {
  key: string;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  options?: { value: string; label: string }[];
  default: number | string;
}

export interface EffectCtx {
  w: number;
  h: number;
  fps: number;
}

export interface EffectDef {
  kind: EffectKind;
  label: string;
  icon: string;
  /** "live" = previews in the default (WebGL) monitor; "export" = applied on export only. */
  preview: "live" | "export";
  blurb: string;
  params: EffectParamDef[];
  /** A comma-joinable ffmpeg filterchain segment ("" = no-op for these params). */
  ffmpeg: (p: Record<string, number | string | boolean>, ctx: EffectCtx) => string;
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);

function ffColor(hex: string): string {
  const h = hex.replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(h) ? `0x${h}` : "0x00ff00";
}

export const EFFECTS: Record<EffectKind, EffectDef> = {
  blur: {
    kind: "blur",
    label: "Gaussian Blur",
    icon: "🌫",
    preview: "live",
    blurb: "Soft gaussian blur.",
    params: [{ key: "amount", label: "Amount", type: "range", min: 0, max: 40, step: 0.5, default: 8 }],
    ffmpeg: (p) => `gblur=sigma=${num(p.amount, 8).toFixed(2)}`,
  },
  chromaKey: {
    kind: "chromaKey",
    label: "Chroma Key",
    icon: "🟢",
    preview: "live",
    blurb: "Make a color transparent (green screen).",
    params: [
      { key: "color", label: "Key color", type: "color", default: "#00ff00" },
      { key: "similarity", label: "Similarity", type: "range", min: 0.01, max: 1, step: 0.01, default: 0.3 },
      { key: "blend", label: "Blend", type: "range", min: 0, max: 1, step: 0.01, default: 0.1 },
    ],
    ffmpeg: (p) =>
      `chromakey=${ffColor(str(p.color, "#00ff00"))}:${num(p.similarity, 0.3).toFixed(3)}:${num(p.blend, 0.1).toFixed(3)}`,
  },
  crop: {
    kind: "crop",
    label: "Crop",
    icon: "▣",
    preview: "live",
    blurb: "Crop edges — the cropped area becomes black (no stretch).",
    params: [
      { key: "left", label: "Left", type: "range", min: 0, max: 0.45, step: 0.01, default: 0 },
      { key: "right", label: "Right", type: "range", min: 0, max: 0.45, step: 0.01, default: 0 },
      { key: "top", label: "Top", type: "range", min: 0, max: 0.45, step: 0.01, default: 0 },
      { key: "bottom", label: "Bottom", type: "range", min: 0, max: 0.45, step: 0.01, default: 0 },
    ],
    ffmpeg: (p) => {
      const l = num(p.left, 0);
      const r = num(p.right, 0);
      const t = num(p.top, 0);
      const bm = num(p.bottom, 0);
      if (l + r + t + bm <= 0) return "";
      const kw = (1 - l - r).toFixed(4); // kept width fraction
      const kh = (1 - t - bm).toFixed(4); // kept height fraction
      // Mask crop: cut the sub-rect, then pad back to the original size at the same
      // position so the kept region stays put and the cut edges go black.
      return (
        `crop=w=iw*${kw}:h=ih*${kh}:x=iw*${l}:y=ih*${t},` +
        `pad=w=iw/${kw}:h=ih/${kh}:x=iw*${l.toFixed(4)}/${kw}:y=ih*${t.toFixed(4)}/${kh}:color=black`
      );
    },
  },
  mirror: {
    kind: "mirror",
    label: "Mirror / Flip",
    icon: "🪞",
    preview: "live",
    blurb: "Flip horizontally and/or vertically.",
    params: [
      {
        key: "axis",
        label: "Axis",
        type: "select",
        default: "h",
        options: [
          { value: "h", label: "Horizontal" },
          { value: "v", label: "Vertical" },
          { value: "both", label: "Both" },
        ],
      },
    ],
    ffmpeg: (p) => {
      const a = str(p.axis, "h");
      return a === "v" ? "vflip" : a === "both" ? "hflip,vflip" : "hflip";
    },
  },
  rotate: {
    kind: "rotate",
    label: "Rotate",
    icon: "↻",
    preview: "live",
    blurb: "Rotate within the frame (corners filled black).",
    params: [{ key: "angle", label: "Angle", type: "range", min: -180, max: 180, step: 1, suffix: "°", default: 0 }],
    ffmpeg: (p) => {
      const a = num(p.angle, 0);
      return a === 0 ? "" : `rotate=${a}*PI/180:fillcolor=black`;
    },
  },
  pixelate: {
    kind: "pixelate",
    label: "Pixelate",
    icon: "▦",
    preview: "live",
    blurb: "Mosaic / blocky look.",
    params: [{ key: "size", label: "Block", type: "range", min: 2, max: 64, step: 1, suffix: "px", default: 12 }],
    ffmpeg: (p, c) => {
      const s = Math.max(2, Math.round(num(p.size, 12)));
      return `scale=iw/${s}:ih/${s}:flags=neighbor,scale=${c.w}:${c.h}:flags=neighbor`;
    },
  },
  sharpen: {
    kind: "sharpen",
    label: "Sharpen",
    icon: "🔺",
    preview: "live",
    blurb: "Unsharp-mask sharpening.",
    params: [{ key: "amount", label: "Amount", type: "range", min: 0, max: 3, step: 0.05, default: 1 }],
    ffmpeg: (p) => `unsharp=5:5:${num(p.amount, 1).toFixed(2)}:5:5:0`,
  },
};

/**
 * Effects split into two render stages so the export matches the GL preview:
 *   - "geom" (crop / mirror / rotate) operate on the CLIP and must run BEFORE the
 *     keyframed transform (zoom/pan/shrink) — otherwise a shrunk clip gets its
 *     black padding cropped instead of its content.
 *   - "filter" (blur / chroma / pixelate / sharpen) are screen-space and run
 *     AFTER the transform, matching PixiJS filters which act at display scale.
 */
const GEOM_KINDS = new Set<EffectKind>(["crop", "mirror", "rotate"]);
const stageOf = (k: EffectKind): "geom" | "filter" => (GEOM_KINDS.has(k) ? "geom" : "filter");

/** ffmpeg filterchain segment for a clip's enabled effects (comma-joined). */
export function effectsFfmpeg(
  effects: EffectSpec[] | undefined,
  ctx: EffectCtx,
  stage?: "geom" | "filter",
): string {
  if (!effects?.length) return "";
  return effects
    .filter((e) => e.enabled && EFFECTS[e.kind])
    .filter((e) => !stage || stageOf(e.kind) === stage)
    .map((e) => EFFECTS[e.kind].ffmpeg(e.params, ctx))
    .filter(Boolean)
    .join(",");
}

/** CSS filter snippet for the effects Canvas2D can preview live (blur). */
export function effectsCssFilter(effects: EffectSpec[] | undefined): string {
  if (!effects?.length) return "";
  const parts: string[] = [];
  for (const e of effects) {
    if (e.enabled && e.kind === "blur") parts.push(`blur(${num(e.params.amount, 8).toFixed(1)}px)`);
  }
  return parts.join(" ");
}

/** True if any enabled effect is export-only (drives the monitor "on export" badge). */
export function hasExportOnlyEffect(effects: EffectSpec[] | undefined): boolean {
  return !!effects?.some((e) => e.enabled && EFFECTS[e.kind]?.preview === "export");
}

/** A fresh effect instance with default params. */
export function newEffect(kind: EffectKind): EffectSpec {
  const params: Record<string, number | string> = {};
  for (const d of EFFECTS[kind].params) params[d.key] = d.default;
  return { id: `fx_${kind}_${Math.round(Math.random() * 1e9).toString(36)}`, kind, enabled: true, params };
}
