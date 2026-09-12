import { anchorExpr, fontById, type Rect } from "@/lib/typography";
import path from "node:path";
import { zoompanTransformFilter, type ClipTransform } from "@/lib/render/transform";
import type {
  AspectRatio,
  ColorLook,
  ImageMotion,
  OverlayPosition,
  Resolution,
  TextAnimation,
  Transition,
} from "@/lib/db/enums";
import { ASPECT_RATIOS, FRAME_DIMENSIONS, RESOLUTIONS } from "@/config/models";

export const TARGET_FPS = 30;

/** Bundled font for burned-in text. Lives in public/ so the standalone runner
 *  (which copies public/) always has it at process.cwd()/public/fonts. */
export const FONT_BOLD = path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf");
/** Directory of the bundled fonts (libass `fontsdir` for burned-in captions). */
export const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

/** Escape the option value, then the filtergraph. spawn adds no shell layer. */
export function ffQuote(p: string): string {
  const normalized = process.platform === "win32" ? p.replaceAll("\\", "/") : p;
  const option = normalized.replace(/[\\':\s]/g, "\\$&");
  return option.replace(/[\\'\[\],;]/g, "\\$&");
}

const BLUR_FILL_SIGMA = 24; // gaussian blur on the enlarged background fill

/** Color-grade filter chain for a look, or null for NONE. */
export function colorLookFilter(look: ColorLook): string | null {
  switch (look) {
    case "WARM":
      return "colorbalance=rs=.06:rm=.05:bs=-.06:bm=-.05,eq=saturation=1.08:gamma=1.02";
    case "COOL":
      return "colorbalance=rs=-.06:bs=.08,eq=saturation=0.95";
    case "BW":
      return "hue=s=0,eq=contrast=1.08";
    case "VINTAGE":
      return "curves=preset=vintage,eq=saturation=0.85";
    case "PUNCH":
      return "eq=contrast=1.18:saturation=1.25:brightness=0.02";
    case "TEAL_ORANGE":
      // Blockbuster grade: push shadows teal, lift skin/highlights warm.
      return "colorbalance=rs=.05:gs=.02:bs=-.08:rm=.06:bm=-.04:rh=.04:bh=.04,eq=contrast=1.08:saturation=1.12";
    case "NOIR":
      return "hue=s=0,eq=contrast=1.35:brightness=-0.03,curves=preset=strong_contrast";
    case "CAMPAIGN":
      // Warm, hopeful patriotic lift.
      return "colorbalance=rs=.04:rm=.06:gm=.02:bs=-.04:bm=-.05,eq=brightness=0.03:contrast=1.06:saturation=1.1";
    case "BLEACH":
      // Bleach-bypass: desaturated, crushed blacks, gritty.
      return "eq=saturation=0.55:contrast=1.3:brightness=-0.02,curves=preset=darker";
    default:
      return null;
  }
}

/** xfade transition name for a Transition, or null for a hard cut (NONE). */
export function xfadeName(t: Transition): string | null {
  switch (t) {
    case "CROSSFADE":
      return "fade";
    case "DISSOLVE":
      return "dissolve";
    case "FADE_BLACK":
      return "fadeblack";
    case "WIPE":
      return "wipeleft";
    case "SLIDE":
      return "slideleft";
    default:
      return null;
  }
}

export function frameDimensions(
  aspectRatio: AspectRatio,
  resolution: Resolution,
): { w: number; h: number } {
  return FRAME_DIMENSIONS[aspectRatio][resolution];
}

export function aspectLabel(aspectRatio: AspectRatio): string {
  return ASPECT_RATIOS[aspectRatio];
}

export function resolutionLabel(resolution: Resolution): string {
  return RESOLUTIONS[resolution];
}

/**
 * Per-clip normalization: fit-inside the target frame, pad to exact size, fix
 * SAR, force fps + yuv420p so concat across heterogeneous sources is clean.
 * Used for both AI-generated and user-uploaded video, and for static stills.
 */
export function normalizeFilter(w: number, h: number, fps = TARGET_FPS): string {
  return [
    `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
    "setsar=1",
    `fps=${fps}`,
    "format=yuv420p",
  ].join(",");
}

/** A static still (no motion). Identical chain to a normalized clip. */
export const stillFilter = normalizeFilter;

const ZOOM_TRAVEL = 0.15; // push/pull zoom range for the strong zooms (1.0 -> 1.15)
const SUBTLE_TRAVEL = 0.04; // very gentle zoom range for the subtle zooms (1.0 -> 1.04)
const PAN_ZOOM = 1.2; // constant zoom for pans, leaving headroom to glide

/**
 * Pan/scan/zoom on a still over `durationS`. Prepare a 2x working frame, repeat
 * it with a static zoompan, then move a fractional source rectangle and scale
 * down. zoompan only supplies frames: using it for movement quantizes the crop
 * and creates visible steps even with a higher-resolution source.
 *
 * Framing differs by intent: pans and the strong zooms COVER the frame (crop to
 * fit) since they assume an image shaped for the frame; the SUBTLE zooms FIT the
 * frame (letterbox if needed) so off-aspect photos keep their whole content and
 * still get a little life.
 */
export function imageMotionFilter(
  motion: ImageMotion,
  w: number,
  h: number,
  durationS: number,
  fps = TARGET_FPS,
): string {
  if (motion === "NONE") return stillFilter(w, h);

  const frames = Math.max(1, Math.round(durationS * fps));
  const ow = w * 2;
  const oh = h * 2;

  const subtle = motion === "SUBTLE_ZOOM_IN" || motion === "SUBTLE_ZOOM_OUT";
  // Subtle zooms preserve the whole image (fit + letterbox); everything else
  // fills the frame (cover + crop).
  const base = subtle
    ? [
        `scale=${ow}:${oh}:force_original_aspect_ratio=decrease`,
        `pad=${ow}:${oh}:(ow-iw)/2:(oh-ih)/2`,
      ]
    : [
        `scale=${ow}:${oh}:force_original_aspect_ratio=increase`,
        `crop=${ow}:${oh}`,
      ];

  const keys = (a: number, b: number) => [{ t: 0, v: a }, { t: 1, v: b }];
  const tr: ClipTransform = { scale: [], posX: [], posY: [] };
  switch (motion) {
    case "ZOOM_IN":
      tr.scale = keys(1, 1 + ZOOM_TRAVEL);
      break;
    case "ZOOM_OUT":
      tr.scale = keys(1 + ZOOM_TRAVEL, 1);
      break;
    case "SUBTLE_ZOOM_IN":
      tr.scale = keys(1, 1 + SUBTLE_TRAVEL);
      break;
    case "SUBTLE_ZOOM_OUT":
      tr.scale = keys(1 + SUBTLE_TRAVEL, 1);
      break;
    case "PAN_RIGHT":
      tr.scale = keys(PAN_ZOOM, PAN_ZOOM);
      tr.posX = keys(-1, 1);
      break;
    case "PAN_LEFT":
      tr.scale = keys(PAN_ZOOM, PAN_ZOOM);
      tr.posX = keys(1, -1);
      break;
    case "PAN_DOWN":
      tr.scale = keys(PAN_ZOOM, PAN_ZOOM);
      tr.posY = keys(-1, 1);
      break;
    case "PAN_UP":
      tr.scale = keys(PAN_ZOOM, PAN_ZOOM);
      tr.posY = keys(1, -1);
      break;
    default:
      return stillFilter(w, h);
  }

  return [
    ...base,
    `zoompan=z=1:d=${frames}:s=${ow}x${oh}:fps=${fps}`,
    zoompanTransformFilter(tr, ow, oh, durationS, fps),
    `scale=${w}:${h}:flags=lanczos`,
    "setsar=1",
    "format=yuv420p",
  ].join(",");
}

// ----------------------------------------------------------------------------
// Per-segment color adjustment + production-polish leaf filters
// ----------------------------------------------------------------------------

/** Per-segment brightness/contrast/saturation via `eq`, or null when neutral. */
export function eqFilter(brightness: number, contrast: number, saturation: number): string | null {
  const b = clampNum(brightness, -1, 1, 0);
  const c = clampNum(contrast, 0, 3, 1);
  const s = clampNum(saturation, 0, 3, 1);
  if (b === 0 && c === 1 && s === 1) return null;
  return `eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${s.toFixed(3)}`;
}

/** A tasteful edge-darkening vignette over the whole frame. */
export function vignetteFilter(): string {
  return "vignette=PI/5";
}

/** Film grain at 0..100 strength, or null when off. */
export function grainFilter(strength: number): string | null {
  const s = Math.round(clampNum(strength, 0, 100, 0));
  if (s <= 0) return null;
  const amt = Math.max(1, Math.round((s / 100) * 40)); // 1..40 noise units
  return `noise=alls=${amt}:allf=t+u`;
}

/**
 * Blur-fill statements for ONE input: split into a blurred cover background and
 * a fit foreground, overlay-centered. Returns `;`-separated links from
 * `[${inLabel}]` to `[${outLabel}]`. `uid` namespaces the intermediate labels.
 */
export function blurFillStatements(
  inLabel: string,
  outLabel: string,
  w: number,
  h: number,
  uid: string,
): string {
  const bg = `bf_bg_${uid}`;
  const fg = `bf_fg_${uid}`;
  const bgb = `bf_bgb_${uid}`;
  const fgs = `bf_fgs_${uid}`;
  return [
    `[${inLabel}]split=2[${bg}][${fg}]`,
    `[${bg}]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=${BLUR_FILL_SIGMA}[${bgb}]`,
    `[${fg}]scale=${w}:${h}:force_original_aspect_ratio=decrease[${fgs}]`,
    `[${bgb}][${fgs}]overlay=(W-w)/2:(H-h)/2:format=auto,setsar=1,format=yuv420p[${outLabel}]`,
  ].join(";");
}

// ----------------------------------------------------------------------------
// Overlay positioning (watermark + text), shared 9-grid resolver
// ----------------------------------------------------------------------------

type XY = { x: string; y: string };

/**
 * Resolve a 9-grid anchor to x/y expressions. Token names differ by filter:
 * overlay uses (W,H,w,h); drawtext uses (w,h,text_w,text_h).
 */
export function positionXY(
  position: OverlayPosition,
  margin: number,
  frameW: string,
  frameH: string,
  objW: string,
  objH: string,
): XY {
  const m = Math.max(0, Math.round(margin));
  const top = position.startsWith("TOP");
  const bottom = position.startsWith("BOTTOM");
  const left = position.endsWith("LEFT");
  const right = position.endsWith("RIGHT");

  const x = left ? `${m}` : right ? `${frameW}-${objW}-${m}` : `(${frameW}-${objW})/2`;
  const y = top ? `${m}` : bottom ? `${frameH}-${objH}-${m}` : `(${frameH}-${objH})/2`;
  return { x, y };
}

/** Hex (#RRGGBB) → ffmpeg color token (0xRRGGBB). Falls back to white. */
export function hexToFfColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? `0x${m[1].toUpperCase()}` : "0xFFFFFF";
}

export interface TextOverlaySpec {
  textfile: string; // absolute path to the (literal) text file
  position: OverlayPosition;
  sizePct: number; // % of frame height
  color: string; // hex
  boxEnabled: boolean;
  boxColor: string; // hex
  boxOpacity: number; // 0..1
  marginPx: number;
  startS: number;
  endS: number | null;
  animation: TextAnimation;
  font: string; // bundled face id (src/lib/typography/fonts)
  outlineW: number; // % of the font size
  shadow: number; // % of the font size
}

/**
 * Build a single `drawtext` filter for one overlay. Text is loaded from a file
 * with expansion disabled so arbitrary user input (colons, %, quotes, newlines)
 * is rendered literally; only the numeric x/y/enable/alpha expressions are
 * evaluated. Shown only within [startS, endS] (endS null = until the end).
 */
export function drawtextFilter(spec: TextOverlaySpec, frameW: number, frameH: number, safeTitle: Rect): string {
  const fontSize = Math.max(8, Math.round((clampNum(spec.sizePct, 1, 40, 6) / 100) * frameH));
  const font = fontById(spec.font);
  // The text anchors to the title-safe edge (src/lib/typography/safe), inset by
  // marginPx plus the box border so the box itself stays inside. The preview
  // (render/draw.ts) and check_text use the same arithmetic.
  const boxBorder = spec.boxEnabled ? Math.max(4, Math.round(fontSize * 0.35)) : 0;
  const { x, y } = anchorExpr(spec.position, safeTitle, spec.marginPx + boxBorder, "text_w", "text_h");
  const color = hexToFfColor(spec.color);
  const s = Math.max(0, spec.startS);
  const e = spec.endS != null && spec.endS > s ? spec.endS : null;
  const S = s.toFixed(3);
  const parts: string[] = [];
  parts.push(`fontfile=${ffQuote(path.join(FONTS_DIR, font.file))}`);
  parts.push(`textfile=${ffQuote(spec.textfile)}`);
  parts.push("expansion=none");
  // POP: the size grows from 82 % over 160 ms (fontsize takes an expression).
  parts.push(spec.animation === "POP" ? `fontsize='${fontSize}*(0.82+0.18*min(1,(t-${S})/0.16))'` : `fontsize=${fontSize}`);
  parts.push(`fontcolor=${color}`);
  parts.push(`x='${x}'`);
  // SLIDE_UP: rises 0.6 em into place over 350 ms, eased out.
  parts.push(spec.animation === "SLIDE_UP" ? `y='${y}+${Math.round(fontSize * 0.6)}*pow(1-min(1,(t-${S})/0.35),2)'` : `y='${y}'`);
  parts.push(`line_spacing=${Math.round(fontSize * 0.15)}`);

  if (spec.boxEnabled) {
    const bo = clampNum(spec.boxOpacity, 0, 1, 0.5).toFixed(2);
    parts.push(`box=1`);
    parts.push(`boxcolor=${hexToFfColor(spec.boxColor)}@${bo}`);
    parts.push(`boxborderw=${boxBorder}`);
  }
  if (spec.outlineW > 0) {
    parts.push(`borderw=${Math.max(1, Math.round((fontSize * spec.outlineW) / 100))}`);
    parts.push("bordercolor=0x000000");
  }
  if (spec.shadow > 0) {
    const d = Math.max(1, Math.round((fontSize * spec.shadow) / 100));
    parts.push(`shadowx=${d}`, `shadowy=${d}`, "shadowcolor=0x000000@0.6");
  }

  parts.push(`enable='${e != null ? `between(t,${S},${e.toFixed(3)})` : `gte(t,${S})`}'`);

  // Entrance / exit ramps (alpha takes an expression).
  const f = e != null ? Math.min(0.4, (e - s) / 2) : 0.4;
  const ramps: [number, number] | null = spec.animation === "FADE" ? [f, f] : spec.animation === "SLIDE_UP" ? [0.35, 0.25] : spec.animation === "POP" ? [0.12, 0.2] : null;
  if (ramps && ramps[0] > 0.01) {
    const [fi, fo] = ramps;
    const fadeIn = `min(1,(t-${S})/${fi.toFixed(3)})`;
    const alpha = e != null ? `if(gt(t,${(e - fo).toFixed(3)}),max(0,(${e.toFixed(3)}-t)/${fo.toFixed(3)}),${fadeIn})` : fadeIn;
    parts.push(`alpha='${alpha}'`);
  }

  return `drawtext=${parts.join(":")}`;
}

function clampNum(v: number, lo: number, hi: number, fallback: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}
