import { spawn } from "node:child_process";
import { rename } from "node:fs/promises";
import path from "node:path";
import { ffmpegPath } from "./binary";
import type { ColorLook, FillMode, ImageMotion, Transition } from "@/lib/db/enums";
import {
  blurFillStatements,
  colorLookFilter,
  drawtextFilter,
  eqFilter,
  ffQuote,
  FONTS_DIR,
  grainFilter,
  imageMotionFilter,
  normalizeFilter,
  positionXY,
  stillFilter,
  TARGET_FPS,
  type TextOverlaySpec,
  vignetteFilter,
  xfadeName,
} from "./args";
import { type EncoderProfile, encoderProfile } from "./encoder";
import { hasAudioStream, probeDuration } from "./probe";
import { type ClipTransform, zoompanTransformFilter } from "@/lib/render/transform";
import { effectsFfmpeg, stabilizeDetectFilter } from "@/config/effects";
import type { EffectSpec } from "@/lib/render/effects";
import type { PipPlacement } from "@/lib/render/pip";

/** Per-segment color adjustment, applied before the project-wide color look. */
export interface SegmentAdjust {
  brightness: number; // -0.3..0.3
  contrast: number; // 0.5..1.5
  saturation: number; // 0..2
}

/** A logo/watermark composited over the whole video. */
export interface WatermarkSpec {
  path: string;
  position: import("@prisma/client").OverlayPosition;
  scale: number; // width as a fraction of the frame width
  opacity: number; // 0..1
  margin: number; // px inset
}

/**
 * One visual segment fed to the assembler. The visual track is source-agnostic:
 *  - video: an AI-generated clip or a user-uploaded video. `speed` retimes it
 *    (0.5–2.0); `muted: false` mixes the clip's OWN audio into the final.
 *  - image: a user-uploaded still shown for `durationS` (optional pan/scan/zoom)
 */
export type VisualInput =
  | {
      kind: "video";
      path: string;
      muted?: boolean;
      speed?: number;
      durationS?: number;
      trimStartS?: number; // source seconds skipped from the start (in-point)
      adjust?: SegmentAdjust;
      transform?: ClipTransform | null; // keyframed scale/pan (Effect Controls)
      effects?: EffectSpec[]; // per-clip effect stack (blur, chroma key, crop, …)
    }
  | {
      kind: "image";
      path: string;
      durationS: number;
      motion: ImageMotion;
      adjust?: SegmentAdjust;
      transform?: ClipTransform | null;
      effects?: EffectSpec[];
    };

/** A V2 overlay clip: a visual composited as picture-in-picture over the base. */
export type OverlayInput = VisualInput & { offsetS: number; pip: PipPlacement };

/** An audio-only clip (unlinked clip audio): a media asset whose audio is taken
 *  from [trimStartS, trimStartS+durationS] and placed at offsetS on the timeline. */
export type AudioClipInput = {
  path: string;
  offsetS: number;
  trimStartS?: number;
  durationS?: number;
  speed?: number;
};

export interface AssembleOpts {
  inputs: VisualInput[]; // V1, in playback order
  overlayClips?: OverlayInput[]; // V2 picture-in-picture overlays
  audioClips?: AudioClipInput[]; // audio-only clips on the audio tracks
  voPath?: string; // absolute audio file (synthesized OR uploaded), optional
  voVolume?: number; // gain on the voiceover (default 1; 0 = muted)
  musicPath?: string; // absolute music-bed file, mixed UNDER the VO, optional
  musicVolume?: number; // 0..1 gain for the bed (default 0.25)
  musicDucking?: boolean; // sidechain-duck the bed under the VO (default true)
  // Foreground audio overlays mixed OVER everything, each starting at offsetS.
  overlays?: { path: string; offsetS: number; volume: number }[];
  width: number;
  height: number;
  audioFitMode: "PAD_VIDEO" | "TRIM_VO";
  // production polish
  colorLook?: ColorLook; // color grade applied to every visual (default NONE)
  transition?: Transition; // between-segment style (default NONE = hard cut)
  transitionMs?: number; // transition duration (default 500)
  audioNormalize?: boolean; // EBU R128 loudnorm on the final mix (default false)
  fillMode?: FillMode; // off-aspect fill: LETTERBOX (default) or BLUR_FILL
  vignette?: boolean; // edge-darkening vignette over the whole video
  grain?: number; // film-grain strength 0..100 (0 = off)
  audioFadeInS?: number; // fade the final mix up over N seconds
  audioFadeOutS?: number; // fade the final mix out over N seconds
  watermark?: WatermarkSpec; // optional logo composited over the whole video
  textOverlays?: TextOverlaySpec[]; // burned-in text (lower-thirds, disclaimers)
  encoder?: EncoderProfile; // video encoder (default CPU x264; GPU when available)
  lutPath?: string; // optional 3D LUT (.cube) applied to every clip after the color look
  captionsAss?: string; // optional libass subtitle file (.ass) burned in after text overlays
  outPath: string; // absolute final destination
  tmpPath: string; // absolute scratch output, renamed to outPath on success
  onProgress?: (percent: number) => void;
}

/**
 * Stitch N visual segments into one MP4 at the target frame size and overlay an
 * optional voiceover plus an optional music bed. No lip-sync: audio is
 * independent and only reconciled by duration (PAD_VIDEO freezes the last frame
 * for a longer VO; TRIM_VO trims the audio to the video length). The music bed
 * is mixed UNDER the VO (optionally sidechain-ducked) and never extends the
 * timeline — it loops to fill and fades out at the end.
 */
/** Clamp playback speed to the single-atempo range (0.5–2.0). */
function clampSpeed(s?: number): number {
  return Math.min(2, Math.max(0.5, s ?? 1));
}

export async function assembleVideo(
  opts: AssembleOpts,
): Promise<{ durationS: number }> {
  if (opts.inputs.length === 0) throw new Error("No visual segments to assemble");

  const n = opts.inputs.length;
  const w = opts.width;
  const h = opts.height;
  const fillMode: FillMode = opts.fillMode ?? "LETTERBOX";
  // Project-wide grade: the built-in look, then an optional user .cube LUT.
  const colorBase =
    [
      colorLookFilter(opts.colorLook ?? "NONE"),
      opts.lutPath ? `lut3d=file=${ffQuote(opts.lutPath)}:interp=tetrahedral` : null,
    ]
      .filter(Boolean)
      .join(",") || null;

  // Stabilization is two-pass: a detection pass per clip writes a .trf that the
  // main graph's vidstabtransform reads. Run those now, keyed by input index.
  const trfPaths = new Map<number, string>();
  {
    const targets: { idx: number; file: string; effects?: EffectSpec[] }[] = [];
    opts.inputs.forEach((inp, i) => {
      if (inp.kind === "video") targets.push({ idx: i, file: inp.path, effects: inp.effects });
    });
    (opts.overlayClips ?? []).forEach((pc, j) => {
      if (pc.kind === "video") targets.push({ idx: n + j, file: pc.path, effects: pc.effects });
    });
    for (const t of targets) {
      const trf = path.join(path.dirname(opts.tmpPath), `stab-${t.idx}.trf`);
      const detect = stabilizeDetectFilter(t.effects, trf);
      if (!detect) continue;
      await runFfmpeg(["-y", "-i", t.file, "-vf", detect, "-an", "-f", "null", "-"], 1);
      trfPaths.set(t.idx, trf);
    }
  }

  // Normalized-PTS tail: trim to the segment's on-screen length (so a trimmed
  // clip is actually cut), ending in `fps` so the link reports a constant frame
  // rate — xfade rejects variable-rate inputs.
  const segTail = (dur: number) =>
    `setpts=PTS-STARTPTS,trim=0:${dur.toFixed(3)},setpts=PTS-STARTPTS,fps=${TARGET_FPS}`;

  // Per-input ffmpeg args, effective (post-speed) durations, and full v-subgraph.
  const inputArgs: string[] = ["-y"];
  const effDur: number[] = [];
  const segGraphs: string[] = [];

  for (let i = 0; i < n; i++) {
    const inp = opts.inputs[i];
    // Per-segment color = project look + this segment's brightness/contrast/sat.
    const eq = eqFilter(
      inp.adjust?.brightness ?? 0,
      inp.adjust?.contrast ?? 1,
      inp.adjust?.saturation ?? 1,
    );
    const colorEq = [colorBase, eq].filter(Boolean).join(",");
    const colorEqLead = colorEq ? `${colorEq},` : ""; // chain-start form
    const colorEqTrail = colorEq ? `,${colorEq}` : ""; // mid-chain form
    // Per-clip effect stack. Geometry (crop/mirror/rotate) runs BEFORE the
    // transform (it operates on the clip); filters (blur/chroma/…) run AFTER it
    // (screen-space, like the GL preview's PixiJS filters).
    const fxCtx = { w, h, fps: TARGET_FPS };
    const fxGeom = effectsFfmpeg(inp.effects, fxCtx, "geom");
    const fxFilt = effectsFfmpeg(inp.effects, fxCtx, "filter");
    const fxGeomLead = fxGeom ? `${fxGeom},` : "";
    const fxGeomTrail = fxGeom ? `,${fxGeom}` : "";
    const fxFiltLead = fxFilt ? `${fxFilt},` : "";
    const fxFiltTrail = fxFilt ? `,${fxFilt}` : "";

    if (inp.kind === "image") {
      const dur = inp.durationS;
      effDur.push(dur);
      if (inp.motion !== "NONE") {
        // Single image in; zoompan GENERATES the frames. No `-loop` (would
        // multiply by zoompan's per-frame count → durationS x fps explosion).
        // Motion stills keep their own fit/cover behavior (no blur-fill).
        inputArgs.push("-i", inp.path);
        segGraphs.push(
          `[${i}:v]${fxGeomLead}${imageMotionFilter(inp.motion, w, h, dur)}${colorEqTrail}${fxFiltTrail},${segTail(dur)}[v${i}]`,
        );
      } else if (fillMode === "BLUR_FILL") {
        inputArgs.push("-loop", "1", "-t", String(dur), "-i", inp.path);
        const sub = blurFillStatements(`${i}:v`, `bfo${i}`, w, h, String(i));
        const tf = zoompanTransformFilter(inp.transform, w, h, dur, TARGET_FPS);
        const tfLead = tf ? `${tf},` : "";
        segGraphs.push(`${sub};[bfo${i}]${colorEqLead}${fxGeomLead}${tfLead}${fxFiltLead}${segTail(dur)}[v${i}]`);
      } else {
        inputArgs.push("-loop", "1", "-t", String(dur), "-i", inp.path);
        const tf = zoompanTransformFilter(inp.transform, w, h, dur, TARGET_FPS);
        const tfPart = tf ? `,${tf}` : "";
        segGraphs.push(`[${i}:v]${stillFilter(w, h)}${colorEqTrail}${fxGeomTrail}${tfPart}${fxFiltTrail},${segTail(dur)}[v${i}]`);
      }
    } else {
      inputArgs.push("-i", inp.path);
      const speed = clampSpeed(inp.speed);
      // Premiere-style in-point: skip the first `trimStartS` source seconds.
      const trimStartS = Math.max(0, inp.trimStartS ?? 0);
      const probed = await probeDuration(inp.path);
      const fullDur = Math.max(0, (probed - trimStartS) / speed);
      const dur = inp.durationS != null ? Math.min(inp.durationS, fullDur) : fullDur;
      effDur.push(dur);
      const sourceTrim =
        trimStartS > 0 ? `trim=start=${trimStartS.toFixed(3)},setpts=PTS-STARTPTS,` : "";
      // Source-stage effects (deinterlace / stabilize / deshake / HDR tone-map)
      // run on the raw decoded frames, before the in-point trim and normalize.
      const fxSrc = effectsFfmpeg(inp.effects, { ...fxCtx, trfPath: trfPaths.get(i) }, "source");
      const fxSrcLead = fxSrc ? `${fxSrc},` : "";
      const retime = speed !== 1 ? `setpts=(PTS-STARTPTS)/${speed}` : "";
      // Retime-stage effects (motion-interpolated slow motion) only make sense
      // when the clip is slowed down.
      const fxRetime = speed < 1 ? effectsFfmpeg(inp.effects, fxCtx, "retime") : "";

      if (fillMode === "BLUR_FILL") {
        // Source effects + trim first (if any), blur-fill, then retime + color.
        let src = `${i}:v`;
        let pre = "";
        const preChain = `${fxSrcLead}${sourceTrim}`.replace(/,$/, "");
        if (preChain) {
          pre = `[${i}:v]${preChain}[vt${i}];`;
          src = `vt${i}`;
        }
        const sub = blurFillStatements(src, `bfo${i}`, w, h, String(i));
        const lead = [retime, fxRetime, colorEq].filter(Boolean).join(",");
        const leadComma = lead ? `${lead},` : "";
        const tf = zoompanTransformFilter(inp.transform, w, h, dur, TARGET_FPS);
        const tfLead = tf ? `${tf},` : "";
        segGraphs.push(`${pre}${sub};[bfo${i}]${leadComma}${fxGeomLead}${tfLead}${fxFiltLead}${segTail(dur)}[v${i}]`);
      } else {
        const retimeTrail = [retime, fxRetime].filter(Boolean).map((f) => `,${f}`).join("");
        const tf = zoompanTransformFilter(inp.transform, w, h, dur, TARGET_FPS);
        const tfPart = tf ? `,${tf}` : "";
        segGraphs.push(
          `[${i}:v]${fxSrcLead}${sourceTrim}${normalizeFilter(w, h)}${retimeTrail}${colorEqTrail}${fxGeomTrail}${tfPart}${fxFiltTrail},${segTail(dur)}[v${i}]`,
        );
      }
    }
  }
  // V2 overlay (PiP) clips: build a normalized WxH frame each (reusing the same
  // color/retime/trim/transform), to be scaled + overlaid onto the base below.
  // Pushed as inputs right after the V1 clips (before the audio inputs).
  const pipClips = opts.overlayClips ?? [];
  const nV1 = n;
  const pipMeta: { label: string; offsetS: number; dur: number; pip: PipPlacement }[] = [];
  for (let j = 0; j < pipClips.length; j++) {
    const pc = pipClips[j];
    const idx = nV1 + j;
    const eq2 = eqFilter(pc.adjust?.brightness ?? 0, pc.adjust?.contrast ?? 1, pc.adjust?.saturation ?? 1);
    const color2 = [colorBase, eq2].filter(Boolean).join(",");
    const color2Trail = color2 ? `,${color2}` : "";
    const fx2Geom = effectsFfmpeg(pc.effects, { w, h, fps: TARGET_FPS }, "geom");
    const fx2Filt = effectsFfmpeg(pc.effects, { w, h, fps: TARGET_FPS }, "filter");
    const fx2GeomTrail = fx2Geom ? `,${fx2Geom}` : "";
    const fx2FiltTrail = fx2Filt ? `,${fx2Filt}` : "";
    let dur: number;
    if (pc.kind === "image") {
      dur = pc.durationS;
      inputArgs.push("-loop", "1", "-t", String(dur), "-i", pc.path);
      const tf = zoompanTransformFilter(pc.transform, w, h, dur, TARGET_FPS);
      const tfPart = tf ? `,${tf}` : "";
      segGraphs.push(`[${idx}:v]${stillFilter(w, h)}${color2Trail}${fx2GeomTrail}${tfPart}${fx2FiltTrail},${segTail(dur)}[ovf${j}]`);
    } else {
      inputArgs.push("-i", pc.path);
      const speed = clampSpeed(pc.speed);
      const trimStartS = Math.max(0, pc.trimStartS ?? 0);
      const probed = await probeDuration(pc.path);
      const fullDur = Math.max(0, (probed - trimStartS) / speed);
      dur = pc.durationS != null ? Math.min(pc.durationS, fullDur) : fullDur;
      const sourceTrim = trimStartS > 0 ? `trim=start=${trimStartS.toFixed(3)},setpts=PTS-STARTPTS,` : "";
      const fx2Src = effectsFfmpeg(pc.effects, { w, h, fps: TARGET_FPS, trfPath: trfPaths.get(idx) }, "source");
      const fx2SrcLead = fx2Src ? `${fx2Src},` : "";
      const retime = speed !== 1 ? `,setpts=(PTS-STARTPTS)/${speed}` : "";
      const fx2Retime = speed < 1 ? effectsFfmpeg(pc.effects, { w, h, fps: TARGET_FPS }, "retime") : "";
      const fx2RetimeTrail = fx2Retime ? `,${fx2Retime}` : "";
      const tf = zoompanTransformFilter(pc.transform, w, h, dur, TARGET_FPS);
      const tfPart = tf ? `,${tf}` : "";
      segGraphs.push(`[${idx}:v]${fx2SrcLead}${sourceTrim}${normalizeFilter(w, h)}${retime}${fx2RetimeTrail}${color2Trail}${fx2GeomTrail}${tfPart}${fx2FiltTrail},${segTail(dur)}[ovf${j}]`);
    }
    pipMeta.push({ label: `ovf${j}`, offsetS: Math.max(0, pc.offsetS), dur, pip: pc.pip });
  }
  const nVideo = nV1 + pipClips.length;

  if (opts.voPath) inputArgs.push("-i", opts.voPath);
  // Loop the bed so a short track fills the whole video; atrim bounds it below.
  if (opts.musicPath) inputArgs.push("-stream_loop", "-1", "-i", opts.musicPath);
  const overlays = opts.overlays ?? [];
  for (const ov of overlays) inputArgs.push("-i", ov.path);
  const audioClips = opts.audioClips ?? [];
  for (const ac of audioClips) inputArgs.push("-i", ac.path);
  // Watermark is the last input so its index is predictable.
  const hasWatermark = !!opts.watermark;
  if (opts.watermark) inputArgs.push("-i", opts.watermark.path);

  const voDur = opts.voPath ? await probeDuration(opts.voPath) : 0;
  const hasVo = !!opts.voPath;
  const hasMusic = !!opts.musicPath;
  const voIdx = nVideo;
  const musicIdx = nVideo + (hasVo ? 1 : 0);
  const overlayBaseIdx = nVideo + (hasVo ? 1 : 0) + (hasMusic ? 1 : 0);
  const audioClipBaseIdx = overlayBaseIdx + overlays.length;
  const watermarkIdx = audioClipBaseIdx + audioClips.length;

  const filters: string[] = [...segGraphs];

  // Transition (xfade) only with >=2 segments; clamp so offsets stay positive.
  const xf = n > 1 ? xfadeName(opts.transition ?? "NONE") : null;
  const T = xf ? Math.min((opts.transitionMs ?? 500) / 1000, Math.min(...effDur) * 0.5, 2) : 0;

  // Each segment's start time on the final timeline (for delaying its own audio).
  const startOffset: number[] = [];
  let videoDur: number;
  let videoLabel = "vcat";
  if (T > 0) {
    startOffset.push(0);
    let prev = "v0";
    let cum = effDur[0];
    for (let k = 1; k < n; k++) {
      startOffset.push(cum - T);
      const out = k === n - 1 ? "vcat" : `xf${k}`;
      filters.push(
        `[${prev}][v${k}]xfade=transition=${xf}:duration=${T.toFixed(3)}:offset=${(cum - T).toFixed(3)}[${out}]`,
      );
      prev = out;
      cum += effDur[k] - T;
    }
    videoDur = cum;
  } else {
    let acc = 0;
    for (let i = 0; i < n; i++) {
      startOffset.push(acc);
      acc += effDur[i];
    }
    filters.push(`${effDur.map((_, i) => `[v${i}]`).join("")}concat=n=${n}:v=1:a=0[vcat]`);
    videoDur = acc;
  }

  // Only the VO can extend the timeline (PAD_VIDEO freezes the last frame for a
  // longer VO). The music bed never extends — it only fills the final duration.
  let outDur = videoDur;
  if (hasVo && opts.audioFitMode === "PAD_VIDEO" && voDur > videoDur) {
    const pad = (voDur - videoDur).toFixed(3);
    filters.push(`[${videoLabel}]tpad=stop_mode=clone:stop_duration=${pad}[vout]`);
    videoLabel = "vout";
    outDur = voDur;
  }

  // V2 overlays: scale each clip to its PiP size, time-shift it to its offset,
  // and composite over the base within [offset, offset+dur]. Grain/vignette/
  // watermark/text below then apply over the whole composite.
  for (let j = 0; j < pipMeta.length; j++) {
    const m = pipMeta[j];
    const pipW = `trunc(${w}*${m.pip.scale.toFixed(4)}/2)*2`;
    const opa =
      m.pip.opacity < 1 ? `,format=rgba,colorchannelmixer=aa=${m.pip.opacity.toFixed(3)}` : "";
    filters.push(`[${m.label}]scale=${pipW}:-2,setsar=1${opa},setpts=PTS+${m.offsetS.toFixed(3)}/TB[pip${j}]`);
    // Center-based PiP (matches pip.ts / draw.ts): posX/posY = box centre as a
    // fraction of the frame; the box may extend off-frame (overlay clips it).
    const x = `main_w*${m.pip.posX.toFixed(4)}-overlay_w/2`;
    const y = `main_h*${m.pip.posY.toFixed(4)}-overlay_h/2`;
    const end = (m.offsetS + m.dur).toFixed(3);
    const out = `pc${j}`;
    filters.push(
      `[${videoLabel}][pip${j}]overlay=x='${x}':y='${y}':enable='between(t,${m.offsetS.toFixed(3)},${end})':eof_action=pass[${out}]`,
    );
    videoLabel = out;
  }

  // Whole-frame post-processing, in order: vignette + grain (one link), then the
  // watermark composite, then burned-in text on top (always legible).
  const vfx: string[] = [];
  if (opts.vignette) vfx.push(vignetteFilter());
  const grain = grainFilter(opts.grain ?? 0);
  if (grain) vfx.push(grain);
  if (vfx.length) {
    filters.push(`[${videoLabel}]${vfx.join(",")}[vfx]`);
    videoLabel = "vfx";
  }

  if (hasWatermark && opts.watermark) {
    const wm = opts.watermark;
    const px = Math.max(2, Math.round(w * Math.min(1, Math.max(0.02, wm.scale))));
    const op = Math.min(1, Math.max(0, wm.opacity)).toFixed(3);
    const { x, y } = positionXY(wm.position, wm.margin, "W", "H", "w", "h");
    filters.push(`[${watermarkIdx}:v]scale=${px}:-2,format=rgba,colorchannelmixer=aa=${op}[wm]`);
    filters.push(`[${videoLabel}][wm]overlay=${x}:${y}:format=auto[vwm]`);
    videoLabel = "vwm";
  }

  const texts = opts.textOverlays ?? [];
  if (texts.length) {
    const chain = texts.map((t) => drawtextFilter(t, h)).join(",");
    filters.push(`[${videoLabel}]${chain}[vtext]`);
    videoLabel = "vtext";
  }

  // Burned-in captions rendered by libass (styled: outline / box / pop), from
  // the .ass file the job wrote. fontsdir points at the bundled DejaVu faces.
  if (opts.captionsAss) {
    filters.push(`[${videoLabel}]ass=filename=${ffQuote(opts.captionsAss)}:fontsdir=${ffQuote(FONTS_DIR)}[vcap]`);
    videoLabel = "vcap";
  }

  const dur = outDur.toFixed(3);
  const vol = Math.min(1, Math.max(0, opts.musicVolume ?? 0.25));
  const voVol = Math.max(0, opts.voVolume ?? 1).toFixed(3);
  const fadeStart = Math.max(0, outDur - 0.75).toFixed(3);

  // Primary track: VO and/or music bed (with optional sidechain ducking) -> [amain].
  let primaryLabel: string | null = null;
  if (hasVo && hasMusic) {
    filters.push(`[${voIdx}:a]volume=${voVol},apad,atrim=0:${dur},asetpts=N/SR/TB[vofit]`);
    filters.push(
      `[${musicIdx}:a]volume=${vol},atrim=0:${dur},afade=t=out:st=${fadeStart}:d=0.75,asetpts=N/SR/TB[mfit]`,
    );
    if (opts.musicDucking ?? true) {
      // Split the VO: one copy mixes in, the other keys the sidechain.
      filters.push(`[vofit]asplit=2[vomix][vokey]`);
      filters.push(
        `[mfit][vokey]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=300[mduck]`,
      );
      filters.push(`[vomix][mduck]amix=inputs=2:duration=longest:normalize=0[amain]`);
    } else {
      filters.push(`[vofit][mfit]amix=inputs=2:duration=longest:normalize=0[amain]`);
    }
    primaryLabel = "amain";
  } else if (hasVo) {
    filters.push(`[${voIdx}:a]volume=${voVol},apad,atrim=0:${dur},asetpts=N/SR/TB[amain]`);
    primaryLabel = "amain";
  } else if (hasMusic) {
    filters.push(
      `[${musicIdx}:a]volume=${vol},atrim=0:${dur},afade=t=out:st=${fadeStart}:d=0.75,asetpts=N/SR/TB[amain]`,
    );
    primaryLabel = "amain";
  }

  // Unmuted video segments: mix each clip's own audio in, retimed by its speed
  // and delayed to its timeline start offset (transition-aware).
  const segAudioLabels: string[] = [];
  for (let i = 0; i < n; i++) {
    const inp = opts.inputs[i];
    if (inp.kind === "video" && inp.muted === false && (await hasAudioStream(inp.path))) {
      const speed = clampSpeed(inp.speed);
      const trimStartS = Math.max(0, inp.trimStartS ?? 0);
      const srcTrim =
        trimStartS > 0 ? `atrim=start=${trimStartS.toFixed(3)},asetpts=N/SR/TB,` : "";
      const tempo = speed !== 1 ? `atempo=${speed},` : "";
      const offsetMs = Math.round(startOffset[i] * 1000);
      const delayPart = offsetMs > 0 ? `adelay=${offsetMs}:all=1,` : "";
      const lbl = `sa${i}`;
      filters.push(
        `[${i}:a]${srcTrim}${tempo}atrim=0:${effDur[i].toFixed(3)},asetpts=N/SR/TB,${delayPart}apad,atrim=0:${dur},asetpts=N/SR/TB[${lbl}]`,
      );
      segAudioLabels.push(lbl);
    }
  }

  // Overlay (V2…Vn) video layers: like V1 clips, an unmuted overlay clip mixes
  // its OWN audio in, retimed by its speed and delayed to its timeline offset.
  // The overlay clip is input index (nV1 + j) and carries its audio stream.
  const pipAudioLabels: string[] = [];
  for (let j = 0; j < pipClips.length; j++) {
    const pc = pipClips[j];
    if (pc.kind !== "video" || pc.muted !== false) continue;
    if (!(await hasAudioStream(pc.path))) continue;
    const m = pipMeta[j];
    const speed = clampSpeed(pc.speed);
    const trimStartS = Math.max(0, pc.trimStartS ?? 0);
    const srcTrim = trimStartS > 0 ? `atrim=start=${trimStartS.toFixed(3)},asetpts=N/SR/TB,` : "";
    const tempo = speed !== 1 ? `atempo=${speed},` : "";
    const offsetMs = Math.max(0, Math.round(m.offsetS * 1000));
    const delayPart = offsetMs > 0 ? `adelay=${offsetMs}:all=1,` : "";
    const lbl = `pa${j}`;
    filters.push(
      `[${nV1 + j}:a]${srcTrim}${tempo}atrim=0:${m.dur.toFixed(3)},asetpts=N/SR/TB,${delayPart}apad,atrim=0:${dur},asetpts=N/SR/TB[${lbl}]`,
    );
    pipAudioLabels.push(lbl);
  }

  // Foreground overlays: each plays OVER everything, delayed to its offset and
  // bounded to the final duration (never extends the timeline).
  const overlayLabels: string[] = [];
  for (let i = 0; i < overlays.length; i++) {
    const ov = overlays[i];
    const vol = Math.min(1, Math.max(0, ov.volume));
    const offsetMs = Math.max(0, Math.round(ov.offsetS * 1000));
    const delayPart = offsetMs > 0 ? `adelay=${offsetMs}:all=1,` : "";
    const lbl = `ov${i}`;
    filters.push(
      `[${overlayBaseIdx + i}:a]volume=${vol},${delayPart}apad,atrim=0:${dur},asetpts=N/SR/TB[${lbl}]`,
    );
    overlayLabels.push(lbl);
  }

  // Audio-only clips: trim the source to [in, in+dur], retime, delay to offsetS.
  const audioClipLabels: string[] = [];
  for (let i = 0; i < audioClips.length; i++) {
    const ac = audioClips[i];
    const speed = clampSpeed(ac.speed ?? 1);
    const trimStartS = Math.max(0, ac.trimStartS ?? 0);
    const clipDur = Math.max(0.1, ac.durationS ?? 0);
    const srcTrim = trimStartS > 0 ? `atrim=start=${trimStartS.toFixed(3)},asetpts=N/SR/TB,` : "";
    const tempo = speed !== 1 ? `atempo=${speed},` : "";
    const offsetMs = Math.max(0, Math.round(ac.offsetS * 1000));
    const delayPart = offsetMs > 0 ? `adelay=${offsetMs}:all=1,` : "";
    const lbl = `ac${i}`;
    filters.push(
      `[${audioClipBaseIdx + i}:a]${srcTrim}${tempo}atrim=0:${clipDur.toFixed(3)},asetpts=N/SR/TB,${delayPart}apad,atrim=0:${dur},asetpts=N/SR/TB[${lbl}]`,
    );
    audioClipLabels.push(lbl);
  }

  // Final audio = primary track plus any unmuted clip audios plus overlays plus
  // audio-only clips.
  const mixLabels = [
    ...(primaryLabel ? [primaryLabel] : []),
    ...segAudioLabels,
    ...pipAudioLabels,
    ...overlayLabels,
    ...audioClipLabels,
  ];
  let audioLabel: string | null = null;
  if (mixLabels.length === 1) {
    audioLabel = mixLabels[0];
  } else if (mixLabels.length > 1) {
    filters.push(
      `${mixLabels.map((l) => `[${l}]`).join("")}amix=inputs=${mixLabels.length}:duration=longest:normalize=0[aout]`,
    );
    audioLabel = "aout";
  }

  // EBU R128 loudness normalization on the final mix (broadcast/social-ready).
  if (audioLabel && (opts.audioNormalize ?? false)) {
    filters.push(`[${audioLabel}]loudnorm=I=-14:TP=-1.5:LRA=11[anorm]`);
    audioLabel = "anorm";
  }

  // Master fade in/out on the final mix (after loudnorm, so it isn't undone).
  const fadeIn = Math.max(0, opts.audioFadeInS ?? 0);
  const fadeOut = Math.max(0, opts.audioFadeOutS ?? 0);
  if (audioLabel && (fadeIn > 0 || fadeOut > 0)) {
    const fades: string[] = [];
    if (fadeIn > 0) fades.push(`afade=t=in:st=0:d=${Math.min(fadeIn, outDur).toFixed(3)}`);
    if (fadeOut > 0) {
      const st = Math.max(0, outDur - fadeOut).toFixed(3);
      fades.push(`afade=t=out:st=${st}:d=${Math.min(fadeOut, outDur).toFixed(3)}`);
    }
    filters.push(`[${audioLabel}]${fades.join(",")}[afade]`);
    audioLabel = "afade";
  }

  // Encoder: CPU x264 by default, or a GPU encoder (NVENC/QSV/VAAPI) chosen by the
  // capability probe. The whole filter graph ran on the CPU; device-memory
  // encoders (VAAPI/QSV) need the composited frames uploaded right before encode.
  const enc = opts.encoder ?? encoderProfile("x264");
  if (enc.needsHwUpload) {
    filters.push(`[${videoLabel}]format=nv12,hwupload[vhw]`);
    videoLabel = "vhw";
  }

  // Device args (e.g. -vaapi_device) are global and must precede the inputs.
  const args: string[] = [...enc.deviceArgs, ...inputArgs];
  args.push("-filter_complex", filters.join(";"));
  args.push("-map", `[${videoLabel}]`);
  if (audioLabel) args.push("-map", `[${audioLabel}]`);

  args.push(...enc.outputArgs, "-r", String(TARGET_FPS));
  if (audioLabel) args.push(...enc.audioArgs);
  args.push(...enc.containerArgs, "-progress", "pipe:1", "-nostats");
  args.push(opts.tmpPath);

  await runFfmpeg(args, outDur || 1, opts.onProgress);
  await rename(opts.tmpPath, opts.outPath);
  return { durationS: outDur };
}

function runFfmpeg(
  args: string[],
  totalDur: number,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args);
    let stderrTail = "";

    proc.stdout.on("data", (d: Buffer) => {
      const text = d.toString();
      const m = /out_time_us=(\d+)/.exec(text);
      if (m && onProgress) {
        const seconds = Number(m[1]) / 1_000_000;
        const pct = Math.max(0, Math.min(99, Math.round((seconds / totalDur) * 100)));
        onProgress(pct);
      }
    });

    proc.stderr.on("data", (d: Buffer) => {
      stderrTail += d.toString();
      if (stderrTail.length > 16_000) stderrTail = stderrTail.slice(-16_000);
    });

    proc.on("error", (e) => reject(new Error(`ffmpeg spawn failed: ${e.message}`)));
    proc.on("close", (code) => {
      if (code === 0) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`ffmpeg exited ${code}: ${stderrTail.slice(-1200)}`));
      }
    });
  });
}
