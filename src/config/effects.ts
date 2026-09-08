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
  /** vidstab transforms file for this clip (set by assemble.ts after the detect pass). */
  trfPath?: string;
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

  // ---- Export-only effects (ffmpeg 9) ---------------------------------------
  denoise: {
    kind: "denoise",
    label: "Denoise",
    icon: "🧹",
    preview: "export",
    blurb: "Remove sensor noise / grain. Fast = hqdn3d; Quality = nlmeans (slow, best for low light).",
    params: [
      { key: "strength", label: "Strength", type: "range", min: 0, max: 10, step: 0.5, default: 3 },
      {
        key: "method",
        label: "Method",
        type: "select",
        default: "fast",
        options: [
          { value: "fast", label: "Fast (hqdn3d)" },
          { value: "quality", label: "Quality (nlmeans, slow)" },
        ],
      },
    ],
    ffmpeg: (p) => {
      const s = num(p.strength, 3);
      if (s <= 0) return "";
      if (str(p.method, "fast") === "quality") return `nlmeans=s=${(s * 0.6).toFixed(2)}:p=7:r=15`;
      return `hqdn3d=${s.toFixed(2)}:${(s * 0.75).toFixed(2)}:${(s * 1.5).toFixed(2)}:${(s * 1.125).toFixed(2)}`;
    },
  },
  detail: {
    kind: "detail",
    label: "Detail (CAS)",
    icon: "✨",
    preview: "export",
    blurb: "Contrast-adaptive sharpening — crisper edges without halos (AMD FidelityFX CAS).",
    params: [{ key: "strength", label: "Strength", type: "range", min: 0, max: 1, step: 0.05, default: 0.5 }],
    ffmpeg: (p) => `cas=strength=${num(p.strength, 0.5).toFixed(2)}`,
  },
  deinterlace: {
    kind: "deinterlace",
    label: "Deinterlace",
    icon: "📼",
    preview: "export",
    blurb: "Remove comb lines from interlaced (camcorder / broadcast) footage.",
    params: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        default: "frame",
        options: [
          { value: "frame", label: "One frame per frame" },
          { value: "field", label: "One frame per field (2× fps)" },
        ],
      },
    ],
    ffmpeg: (p) => `bwdif=mode=${str(p.mode, "frame") === "field" ? "send_field" : "send_frame"}:parity=auto:deint=all`,
  },
  deshake: {
    kind: "deshake",
    label: "Deshake",
    icon: "🤝",
    preview: "export",
    blurb: "Quick single-pass shake reduction. For serious shake use Stabilize.",
    params: [{ key: "range", label: "Search range", type: "range", min: 8, max: 64, step: 4, suffix: "px", default: 16 }],
    ffmpeg: (p) => {
      const r = Math.round(num(p.range, 16));
      return `deshake=rx=${r}:ry=${r}:edge=mirror:blocksize=8:contrast=125`;
    },
  },
  stabilize: {
    kind: "stabilize",
    label: "Stabilize",
    icon: "🎯",
    preview: "export",
    blurb: "Two-pass stabilization (vidstab): analyzes the clip's motion, then smooths it.",
    params: [
      { key: "shakiness", label: "Shakiness", type: "range", min: 1, max: 10, step: 1, default: 5 },
      { key: "smoothing", label: "Smoothing", type: "range", min: 0, max: 60, step: 1, default: 15 },
      { key: "zoom", label: "Zoom-in", type: "range", min: 0, max: 20, step: 1, suffix: "%", default: 0 },
    ],
    ffmpeg: (p, c) => {
      if (!c.trfPath) return ""; // no detect pass ran (e.g. a still) → no-op
      const smoothing = Math.round(num(p.smoothing, 15));
      const zoom = num(p.zoom, 0);
      return `vidstabtransform=input=${ffQuote(c.trfPath)}:smoothing=${smoothing}:zoom=${zoom}:optzoom=1:interpol=bicubic`;
    },
  },
  smoothSlowmo: {
    kind: "smoothSlowmo",
    label: "Smooth Slow Motion",
    icon: "🐢",
    preview: "export",
    blurb: "Synthesizes in-between frames when the clip is slowed down (speed < 1×) instead of repeating frames.",
    params: [
      {
        key: "mode",
        label: "Method",
        type: "select",
        default: "mci",
        options: [
          { value: "mci", label: "Motion compensated (best)" },
          { value: "blend", label: "Blend (fast)" },
        ],
      },
    ],
    ffmpeg: (p, c) =>
      str(p.mode, "mci") === "blend"
        ? `minterpolate=fps=${c.fps}:mi_mode=blend`
        : `minterpolate=fps=${c.fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
  },
  tonemap: {
    kind: "tonemap",
    label: "HDR → SDR",
    icon: "🌗",
    preview: "export",
    blurb: "Tone-map HDR (HLG / PQ) phone footage to SDR so it isn't washed out on an SDR timeline.",
    params: [
      {
        key: "source",
        label: "Source HDR",
        type: "select",
        default: "hlg",
        options: [
          { value: "hlg", label: "HLG (iPhone / Android default)" },
          { value: "pq", label: "HDR10 / PQ (Dolby Vision 8.x)" },
        ],
      },
      {
        key: "algo",
        label: "Curve",
        type: "select",
        default: "hable",
        options: [
          { value: "hable", label: "Hable (filmic)" },
          { value: "mobius", label: "Möbius (bright)" },
          { value: "reinhard", label: "Reinhard (soft)" },
        ],
      },
      { key: "desat", label: "Desaturate highlights", type: "range", min: 0, max: 2, step: 0.1, default: 0.5 },
    ],
    // The source transfer/primaries are stamped explicitly with `setparams`
    // (phone clips often carry incomplete metadata; zimg rejects tin/pin
    // overrides on this build): BT.2020 + PQ or HLG → linear → tone-map →
    // BT.709 SDR. 10-bit YUV in, so an 8-bit/RGB source is up-converted first.
    ffmpeg: (p) => {
      const trc = str(p.source, "hlg") === "pq" ? "smpte2084" : "arib-std-b67";
      return (
        `format=yuv420p10le,setparams=color_primaries=bt2020:color_trc=${trc}:colorspace=bt2020nc,` +
        `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,` +
        `tonemap=tonemap=${str(p.algo, "hable")}:desat=${num(p.desat, 0.5).toFixed(2)},` +
        `zscale=t=bt709:m=bt709:r=tv,format=yuv420p`
      );
    },
  },
};

/**
 * Effects split into render stages so the export matches the GL preview:
 *   - "source" (deinterlace / stabilize / deshake / tone-map) run on the raw
 *     decoded frames, before the in-point trim and the frame normalize — a
 *     stabilizer's transforms are per source frame, a deinterlacer needs fields.
 *   - "retime" (smooth slow motion) runs right after the speed change.
 *   - "geom" (crop / mirror / rotate) operate on the CLIP and must run BEFORE the
 *     keyframed transform (zoom/pan/shrink) — otherwise a shrunk clip gets its
 *     black padding cropped instead of its content.
 *   - "filter" (blur / chroma / pixelate / sharpen / denoise / detail) are
 *     screen-space and run AFTER the transform, matching PixiJS filters which
 *     act at display scale.
 */
export type EffectStage = "source" | "retime" | "geom" | "filter";
const SOURCE_KINDS = new Set<EffectKind>(["deinterlace", "stabilize", "deshake", "tonemap"]);
const RETIME_KINDS = new Set<EffectKind>(["smoothSlowmo"]);
const GEOM_KINDS = new Set<EffectKind>(["crop", "mirror", "rotate"]);
const stageOf = (k: EffectKind): EffectStage =>
  SOURCE_KINDS.has(k) ? "source" : RETIME_KINDS.has(k) ? "retime" : GEOM_KINDS.has(k) ? "geom" : "filter";

/** Quote a path as a filter option value (single quotes; embedded quotes escaped). */
function ffQuote(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`;
}

/** The vidstabdetect pass for a clip whose stack enables Stabilize (null otherwise). */
export function stabilizeDetectFilter(effects: EffectSpec[] | undefined, trfPath: string): string | null {
  const e = effects?.find((x) => x.enabled && x.kind === "stabilize");
  if (!e) return null;
  const shakiness = Math.max(1, Math.min(10, Math.round(num(e.params.shakiness, 5))));
  return `vidstabdetect=shakiness=${shakiness}:accuracy=15:result=${ffQuote(trfPath)}`;
}

/** ffmpeg filterchain segment for a clip's enabled effects (comma-joined). */
export function effectsFfmpeg(
  effects: EffectSpec[] | undefined,
  ctx: EffectCtx,
  stage?: EffectStage,
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
