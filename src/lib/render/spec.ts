/**
 * RenderSpec — a framework-agnostic description of the timeline composite. The
 * browser compositor (live preview) interprets it; ffmpeg (assemble.ts) produces
 * the authoritative final render from the same project. Keep the two in visual
 * agreement; the preview is a fast approximation, the export is the truth.
 */
import { withBase } from "@/lib/basePath";
import { buildCaptions } from "./captions";
import { asEffects, type EffectSpec } from "./effects";
import { asPip, type PipPlacement } from "./pip";
import { asTransform, type ClipTransform } from "./transform";

export type Motion =
  | "NONE"
  | "ZOOM_IN"
  | "ZOOM_OUT"
  | "PAN_LEFT"
  | "PAN_RIGHT"
  | "PAN_UP"
  | "PAN_DOWN"
  | "SUBTLE_ZOOM_IN"
  | "SUBTLE_ZOOM_OUT";
export type Transition = "NONE" | "CROSSFADE" | "DISSOLVE" | "FADE_BLACK" | "WIPE" | "SLIDE";
export type ColorLook =
  | "NONE" | "WARM" | "COOL" | "BW" | "VINTAGE" | "PUNCH"
  | "TEAL_ORANGE" | "NOIR" | "CAMPAIGN" | "BLEACH";
export type FillMode = "LETTERBOX" | "BLUR_FILL";
export type Position =
  | "TOP_LEFT" | "TOP_CENTER" | "TOP_RIGHT"
  | "MIDDLE_LEFT" | "CENTER" | "MIDDLE_RIGHT"
  | "BOTTOM_LEFT" | "BOTTOM_CENTER" | "BOTTOM_RIGHT";

export interface RenderClip {
  id: string;
  kind: "video" | "image";
  url: string | null; // null when the segment has no asset yet (e.g. AI not rendered)
  start: number; // timeline seconds
  end: number; // timeline seconds (start + on-screen duration)
  srcStart: number; // source in-point (video)
  speed: number;
  muted: boolean; // video clips: is the clip's own audio silenced?
  motion: Motion; // image pan/zoom
  adjust: { brightness: number; contrast: number; saturation: number };
  transform: ClipTransform | null; // keyframed scale/pan (Effect Controls)
  effects: EffectSpec[]; // per-clip effect stack (blur, chroma key, crop, …)
}

/** A V2 overlay clip: a picture-in-picture composited over the V1 base. */
export interface RenderOverlay extends RenderClip {
  pip: PipPlacement;
}

export interface RenderText {
  text: string;
  position: Position;
  sizePct: number;
  color: string;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  marginPx: number;
  startS: number;
  endS: number | null;
  animation: "NONE" | "FADE";
}

/** An audio-only clip on an audio track: the asset's audio in [srcStart, +dur]
 *  placed at `start` on the timeline. */
export interface RenderAudioClip {
  id: string;
  url: string;
  start: number; // timeline seconds
  durationS: number;
  srcStart: number; // source in-point
  speed: number;
}

export interface RenderSpec {
  width: number; // preview pixel dims
  height: number;
  duration: number; // seconds
  clips: RenderClip[];
  audioClips: RenderAudioClip[]; // audio-only clips on the audio tracks
  overlays: RenderOverlay[]; // V2 picture-in-picture clips
  transition: { type: Transition; durationS: number };
  colorLook: ColorLook;
  fillMode: FillMode;
  vignette: boolean;
  grain: number; // 0..100
  texts: RenderText[];
  watermark: { url: string; position: Position; scale: number; opacity: number; margin: number } | null;
  audio: { voUrl: string | null; voVolume: number; musicUrl: string | null; musicVolume: number };
}

interface SegmentLike {
  id: string;
  source: string;
  clipAssetId: string | null;
  sourceAssetId: string | null;
  durationS: number;
  trimStartS: number;
  speed: number;
  imageMotion: string;
  brightness: number;
  contrast: number;
  saturation: number;
  transform?: unknown;
  effects?: unknown;
  track?: number;
  offsetS?: number;
  pip?: unknown;
  muted?: boolean;
  audioOnly?: boolean;
  library?: boolean;
}

interface TextLike {
  text: string;
  position: string;
  sizePct: number;
  color: string;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  marginPx: number;
  startS: number;
  endS: number | null;
  animation: string;
}

export interface BuildInput {
  segments: SegmentLike[];
  width: number; // full output dims (e.g. 1280x720)
  height: number;
  transition: string;
  transitionMs: number;
  colorLook: string;
  fillMode: string;
  vignette: boolean;
  grain: number;
  audioFitMode: string;
  texts: TextLike[];
  watermark: { assetId: string | null; position: string; scale: number; opacity: number; margin: number };
  voAssetId: string | null;
  voVolume: number;
  musicAssetId: string | null;
  musicVolume: number;
  voDurationS: number | null;
  captions?: { enabled: boolean; text: string; spanS: number; position: string; sizePct: number };
}

const PREVIEW_MAX_W = 854; // cap preview resolution for decode/composite perf

const assetUrl = (id: string) => withBase(`/api/assets/${id}`);

/** The visual asset id + kind for a segment, or null if it has none yet. */
function visualOf(s: SegmentLike): { kind: "video" | "image"; assetId: string } | null {
  if (s.source === "UPLOAD_IMAGE_STILL") {
    return s.sourceAssetId ? { kind: "image", assetId: s.sourceAssetId } : null;
  }
  if (s.source === "UPLOAD_VIDEO") {
    return s.sourceAssetId ? { kind: "video", assetId: s.sourceAssetId } : null;
  }
  // AI_GENERATED / UPLOAD_IMAGE_DRIVER -> the rendered clip
  return s.clipAssetId ? { kind: "video", assetId: s.clipAssetId } : null;
}

export function buildRenderSpec(input: BuildInput): RenderSpec {
  const scale = Math.min(1, PREVIEW_MAX_W / input.width);
  const width = Math.round((input.width * scale) / 2) * 2;
  const height = Math.round((input.height * scale) / 2) * 2;

  // V1 = the contiguous main sequence; V2 = positioned overlay (PiP) clips.
  // Audio-only clips carry no video and are handled as audioClips below. Library
  // clips live in the Media Bucket only — never in the preview/render.
  const seg0 = input.segments.filter((s) => !s.library);
  const v1Segs = seg0.filter((s) => (s.track ?? 0) === 0 && !s.audioOnly);
  const v2Segs = seg0.filter((s) => (s.track ?? 0) === 1 && !s.audioOnly);
  const effDur = v1Segs.map((s) => Math.max(0.1, s.durationS));
  const n = v1Segs.length;

  const transition = (input.transition as Transition) ?? "NONE";
  const T =
    transition !== "NONE" && n > 1
      ? Math.min((input.transitionMs ?? 500) / 1000, Math.min(...effDur) * 0.5, 2)
      : 0;

  const baseClip = (s: SegmentLike, start: number, end: number): RenderClip => {
    const vis = visualOf(s);
    return {
      id: s.id,
      kind: vis?.kind ?? "image",
      url: vis ? assetUrl(vis.assetId) : null,
      start,
      end,
      srcStart: Math.max(0, s.trimStartS ?? 0),
      speed: Math.min(2, Math.max(0.5, s.speed ?? 1)),
      muted: s.muted ?? true,
      motion: (s.imageMotion as Motion) ?? "NONE",
      adjust: { brightness: s.brightness ?? 0, contrast: s.contrast ?? 1, saturation: s.saturation ?? 1 },
      transform: asTransform(s.transform),
      effects: asEffects(s.effects),
    };
  };

  // V1 timeline positions, transition-overlapped (matches assemble.ts).
  const clips: RenderClip[] = [];
  let start = 0;
  for (let i = 0; i < n; i++) {
    const end = start + effDur[i];
    clips.push(baseClip(v1Segs[i], start, end));
    start = end - T; // next clip overlaps by the transition duration
  }
  const videoDuration = n > 0 ? clips[n - 1].end : 0;

  // V2 overlays: positioned at offsetS with a PiP placement over the base.
  const overlays: RenderOverlay[] = v2Segs.map((s) => {
    const off = Math.max(0, s.offsetS ?? 0);
    return { ...baseClip(s, off, off + Math.max(0.1, s.durationS)), pip: asPip(s.pip) };
  });

  // Audio-only clips: source audio in [trimStartS, +dur] placed at offsetS.
  const audioOnlySegs = seg0.filter((s) => s.audioOnly);
  const audioClips: RenderAudioClip[] = audioOnlySegs.flatMap((s) => {
    const vis = visualOf(s);
    if (!vis) return [];
    return [
      {
        id: s.id,
        url: assetUrl(vis.assetId),
        start: Math.max(0, s.offsetS ?? 0),
        durationS: Math.max(0.1, s.durationS),
        srcStart: Math.max(0, s.trimStartS ?? 0),
        speed: Math.min(2, Math.max(0.5, s.speed ?? 1)),
      },
    ];
  });
  const audioClipEnd = audioClips.reduce((m, a) => Math.max(m, a.start + a.durationS), 0);

  // Only the VO (or a trailing audio clip) can extend the timeline.
  const voDur = input.voAssetId ? (input.voDurationS ?? 0) : 0;
  const baseDuration = Math.max(videoDuration, audioClipEnd);
  const duration =
    input.audioFitMode === "PAD_VIDEO" && voDur > baseDuration ? voDur : baseDuration;

  const userTexts: RenderText[] = input.texts.map((t) => ({
    text: t.text,
    position: t.position as Position,
    sizePct: t.sizePct,
    color: t.color,
    boxEnabled: t.boxEnabled,
    boxColor: t.boxColor,
    boxOpacity: t.boxOpacity,
    marginPx: t.marginPx,
    startS: t.startS,
    endS: t.endS,
    animation: (t.animation as "NONE" | "FADE") ?? "NONE",
  }));
  const captionTexts: RenderText[] = input.captions?.enabled
    ? buildCaptions(input.captions.text, input.captions.spanS, {
        position: input.captions.position,
        sizePct: input.captions.sizePct,
        marginPx: 40,
      }).map((c) => ({
        text: c.text,
        position: c.position as Position,
        sizePct: c.sizePct,
        color: c.color,
        boxEnabled: c.boxEnabled,
        boxColor: c.boxColor,
        boxOpacity: c.boxOpacity,
        marginPx: c.marginPx,
        startS: c.startS,
        endS: c.endS,
        animation: c.animation,
      }))
    : [];

  return {
    width,
    height,
    duration: Math.max(0.1, duration),
    clips,
    audioClips,
    overlays,
    transition: { type: transition, durationS: T },
    colorLook: (input.colorLook as ColorLook) ?? "NONE",
    fillMode: (input.fillMode as FillMode) ?? "LETTERBOX",
    vignette: !!input.vignette,
    grain: input.grain ?? 0,
    texts: [...userTexts, ...captionTexts],
    watermark: input.watermark.assetId
      ? {
          url: assetUrl(input.watermark.assetId),
          position: input.watermark.position as Position,
          scale: input.watermark.scale,
          opacity: input.watermark.opacity,
          margin: input.watermark.margin,
        }
      : null,
    audio: {
      voUrl: input.voAssetId ? assetUrl(input.voAssetId) : null,
      voVolume: input.voVolume,
      musicUrl: input.musicAssetId ? assetUrl(input.musicAssetId) : null,
      musicVolume: input.musicVolume,
    },
  };
}

/** Clip(s) visible at time t: the active clip plus, in a transition window, the
 *  outgoing clip with a 0..1 crossfade progress. */
export function clipsAt(spec: RenderSpec, t: number): {
  current: RenderClip | null;
  outgoing: RenderClip | null;
  mix: number; // 0..1 crossfade from outgoing->current
} {
  const { clips, transition } = spec;
  const T = transition.durationS;
  let current: RenderClip | null = null;
  for (const c of clips) {
    if (t >= c.start && t < c.end) {
      current = c;
      break;
    }
  }
  // Past the end (VO pad): freeze the last clip.
  if (!current && clips.length && t >= clips[clips.length - 1].end) {
    current = clips[clips.length - 1];
  }
  if (!current) return { current: null, outgoing: null, mix: 1 };

  // In the overlap window with the previous clip?
  if (T > 0) {
    const idx = clips.indexOf(current);
    if (idx > 0) {
      const prev = clips[idx - 1];
      if (t < prev.end) {
        const mix = (t - current.start) / T; // 0 at start of overlap -> 1
        return { current, outgoing: prev, mix: Math.min(1, Math.max(0, mix)) };
      }
    }
  }
  return { current, outgoing: null, mix: 1 };
}

/** Local source time within a clip for timeline time t (video seek target). */
export function sourceTime(clip: RenderClip, t: number): number {
  const local = Math.max(0, Math.min(clip.end - clip.start, t - clip.start));
  return clip.srcStart + local * clip.speed;
}
