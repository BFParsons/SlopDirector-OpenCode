/**
 * Media perception for agents: frame grabs, contact sheets, scene cuts and
 * silences — the "eyes and ears" an editing agent needs before it can decide
 * where to cut. Every function is a thin ffmpeg wrapper; image outputs are
 * cached under the project's `cache/` dir keyed on the request parameters.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { FONT_BOLD } from "@/lib/ffmpeg/args";
import { ffmpegPath } from "@/lib/ffmpeg/binary";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { projectDir } from "@/lib/assets/storage";

function run(args: string[], timeoutMs = 10 * 60_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), ["-hide_banner", "-nostdin", ...args]);
    let stderr = "";
    const to = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
    proc.stdout.on("data", () => {});
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 4_000_000) stderr = stderr.slice(-2_000_000);
    });
    proc.on("error", (e) => {
      clearTimeout(to);
      reject(new Error(`ffmpeg spawn failed: ${e.message}`));
    });
    proc.on("close", (code) => {
      clearTimeout(to);
      resolve({ code: code ?? -1, stderr });
    });
  });
}

/** `<ASSET_ROOT>/<projectId>/cache` — derived files an agent asks for repeatedly. */
export async function cacheDir(projectId: string): Promise<string> {
  const dir = path.join(projectDir(projectId), "cache");
  await mkdir(dir, { recursive: true });
  return dir;
}

const clean = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");

/** One JPEG frame at `t` seconds, `width` px wide (aspect kept). Returns the file path. */
export async function frameAt(
  abs: string,
  projectId: string,
  assetId: string,
  t: number,
  width: number,
): Promise<string> {
  const dir = await cacheDir(projectId);
  const out = path.join(dir, `frame-${assetId}-${clean(t)}-${width}.jpg`);
  if (existsSync(out)) return out;
  // -ss before -i: keyframe seek, then decode forward to the exact frame.
  const { code, stderr } = await run([
    "-y", "-ss", String(Math.max(0, t)), "-i", abs, "-frames:v", "1",
    "-vf", `scale=${width}:-2`, "-q:v", "3", out,
  ]);
  if (code !== 0 || !existsSync(out)) throw new Error(`frame grab failed: ${stderr.slice(-400)}`);
  return out;
}

export interface ContactSheetOpts {
  cols: number;
  rows: number;
  /** width of the whole sheet in px */
  width: number;
  startS: number;
  endS: number;
}

/**
 * A cols×rows grid of frames sampled evenly across [startS, endS], each
 * stamped with its source timestamp so a model can read times off the image.
 * Returns the file path plus the sampled times.
 */
export async function contactSheet(
  abs: string,
  projectId: string,
  assetId: string,
  o: ContactSheetOpts,
): Promise<{ path: string; times: number[]; cellWidth: number }> {
  const n = o.cols * o.rows;
  const span = Math.max(0.01, o.endS - o.startS);
  const interval = span / n;
  const times = Array.from({ length: n }, (_, i) => +(o.startS + i * interval).toFixed(3));
  const cellWidth = Math.max(64, Math.floor(o.width / o.cols));
  const dir = await cacheDir(projectId);
  const out = path.join(
    dir,
    `sheet-${assetId}-${o.cols}x${o.rows}-${o.width}-${clean(o.startS)}-${clean(o.endS)}.jpg`,
  );
  if (existsSync(out)) return { path: out, times, cellWidth };
  // Pick the FIRST frame at or after each sample time (select on the bucket
  // index), so the frame shown is the one the stamp says. (`fps=1/interval`
  // keeps the last frame of each bucket — half an interval later than its
  // label — which sent an agent's trims to the wrong place.) drawtext prints
  // the absolute source time: pts is rebased by -ss, so add startS back.
  const font = FONT_BOLD.replace(/\\/g, "/").replace(/:/g, "\\:");
  const fontsize = Math.max(12, Math.round(cellWidth / 12));
  const iv = interval.toFixed(4);
  const pick = `select='isnan(prev_selected_t)+gt(floor(t/${iv}),floor(prev_selected_t/${iv}))'`;
  const stamp =
    `drawtext=fontfile='${font}':text='%{pts\\:hms\\:${o.startS}}':x=6:y=6:` +
    `fontsize=${fontsize}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=4`;
  const vf =
    `${pick},scale=${cellWidth}:-2,${stamp},` +
    `tile=${o.cols}x${o.rows}:padding=2:margin=2:color=black`;
  const { code, stderr } = await run([
    "-y", "-ss", String(o.startS), "-t", String(span), "-i", abs,
    "-fps_mode", "passthrough", "-frames:v", "1", "-vf", vf, "-q:v", "4", out,
  ]);
  if (code !== 0 || !existsSync(out)) throw new Error(`contact sheet failed: ${stderr.slice(-400)}`);
  return { path: out, times, cellWidth };
}

export interface SceneResult {
  durationS: number;
  threshold: number;
  /** timestamps (s) where a new shot starts */
  cuts: number[];
  /** the shots those cuts delimit, covering the whole clip */
  shots: { startS: number; endS: number }[];
}

/** Scene-cut detection (ffmpeg `select=gt(scene,threshold)`), on a 320px proxy for speed. */
export async function detectScenes(abs: string, threshold = 0.4, max = 500): Promise<SceneResult> {
  const durationS = await probeDuration(abs);
  const { code, stderr } = await run([
    "-i", abs, "-an", "-vf",
    `scale=320:-2,select='gt(scene,${threshold})',showinfo`, "-f", "null", "-",
  ]);
  if (code !== 0) throw new Error(`scene detection failed: ${stderr.slice(-400)}`);
  const cuts: number[] = [];
  for (const m of stderr.matchAll(/pts_time:\s*([0-9.]+)/g)) {
    const t = Number(m[1]);
    if (Number.isFinite(t) && t > 0.05) cuts.push(+t.toFixed(3));
    if (cuts.length >= max) break;
  }
  const bounds = [0, ...cuts, durationS];
  const shots: { startS: number; endS: number }[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    if (bounds[i + 1] - bounds[i] > 0.01) shots.push({ startS: bounds[i], endS: bounds[i + 1] });
  }
  return { durationS, threshold, cuts, shots };
}

export interface SilenceResult {
  durationS: number;
  noiseDb: number;
  minS: number;
  silences: { startS: number; endS: number; durationS: number }[];
  /** the complement: ranges with sound */
  speech: { startS: number; endS: number }[];
}

/** Silence detection (ffmpeg `silencedetect`), plus the non-silent ranges an edit would keep. */
export async function detectSilences(abs: string, noiseDb = -30, minS = 0.5): Promise<SilenceResult> {
  const durationS = await probeDuration(abs);
  const { code, stderr } = await run([
    "-i", abs, "-vn", "-af", `silencedetect=noise=${noiseDb}dB:d=${minS}`, "-f", "null", "-",
  ]);
  if (code !== 0) throw new Error(`silence detection failed: ${stderr.slice(-400)}`);
  const silences: { startS: number; endS: number; durationS: number }[] = [];
  let open: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = /silence_start:\s*(-?[0-9.]+)/.exec(line);
    if (s) open = Math.max(0, Number(s[1]));
    const e = /silence_end:\s*([0-9.]+)/.exec(line);
    if (e && open != null) {
      const endS = Number(e[1]);
      silences.push({ startS: +open.toFixed(3), endS: +endS.toFixed(3), durationS: +(endS - open).toFixed(3) });
      open = null;
    }
  }
  if (open != null && durationS > open) {
    silences.push({ startS: +open.toFixed(3), endS: +durationS.toFixed(3), durationS: +(durationS - open).toFixed(3) });
  }
  const speech: { startS: number; endS: number }[] = [];
  let cursor = 0;
  for (const sil of silences) {
    if (sil.startS - cursor > 0.05) speech.push({ startS: +cursor.toFixed(3), endS: sil.startS });
    cursor = sil.endS;
  }
  if (durationS - cursor > 0.05) speech.push({ startS: +cursor.toFixed(3), endS: +durationS.toFixed(3) });
  return { durationS, noiseDb, minS, silences, speech };
}

/** Mono 16 kHz WAV of the asset's audio (what Whisper wants). Returns the path. */
export async function extractWav(abs: string, projectId: string, assetId: string): Promise<string> {
  const dir = await cacheDir(projectId);
  const out = path.join(dir, `audio-${assetId}-16k.wav`);
  if (existsSync(out)) return out;
  const { code, stderr } = await run(["-y", "-i", abs, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out]);
  if (code !== 0 || !existsSync(out)) throw new Error(`audio extract failed: ${stderr.slice(-400)}`);
  return out;
}

export interface BlackFrameResult {
  durationS: number;
  /** stretches where the picture is (nearly) all black */
  black: { startS: number; endS: number; durationS: number }[];
}

/** Black stretches (ffmpeg `blackdetect`): a flash of black at a cut, a missing clip, an unintended fade. */
export async function detectBlack(abs: string, minS = 0.1, pixThreshold = 0.1): Promise<BlackFrameResult> {
  const durationS = await probeDuration(abs);
  const { code, stderr } = await run(["-i", abs, "-an", "-vf", `blackdetect=d=${minS}:pix_th=${pixThreshold}`, "-f", "null", "-"]);
  if (code !== 0) throw new Error(`black detection failed: ${stderr.slice(-400)}`);
  const black: BlackFrameResult["black"] = [];
  for (const m of stderr.matchAll(/black_start:\s*([0-9.]+)\s+black_end:\s*([0-9.]+)\s+black_duration:\s*([0-9.]+)/g)) {
    black.push({ startS: +Number(m[1]).toFixed(3), endS: +Number(m[2]).toFixed(3), durationS: +Number(m[3]).toFixed(3) });
  }
  return { durationS, black };
}

export interface FrozenFrameResult {
  durationS: number;
  /** stretches where consecutive frames are identical (a stalled clip, a hold that wasn't meant) */
  frozen: { startS: number; endS: number; durationS: number }[];
}

/** Frozen picture (ffmpeg `freezedetect`), on a 320px proxy for speed. */
export async function detectFrozen(abs: string, minS = 1, noiseDb = -60): Promise<FrozenFrameResult> {
  const durationS = await probeDuration(abs);
  const { code, stderr } = await run(["-i", abs, "-an", "-vf", `scale=320:-2,freezedetect=n=${noiseDb}dB:d=${minS}`, "-f", "null", "-"]);
  if (code !== 0) throw new Error(`freeze detection failed: ${stderr.slice(-400)}`);
  const frozen: FrozenFrameResult["frozen"] = [];
  let start: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = /freeze_start:\s*([0-9.]+)/.exec(line);
    if (s) start = Number(s[1]);
    const e = /freeze_end:\s*([0-9.]+)/.exec(line);
    if (e && start != null) {
      const endS = Number(e[1]);
      frozen.push({ startS: +start.toFixed(3), endS: +endS.toFixed(3), durationS: +(endS - start).toFixed(3) });
      start = null;
    }
  }
  if (start != null && durationS - start > minS) frozen.push({ startS: +start.toFixed(3), endS: +durationS.toFixed(3), durationS: +(durationS - start).toFixed(3) });
  return { durationS, frozen };
}

export interface LoudnessPoint {
  t: number;
  /** momentary loudness (400 ms window), LUFS */
  m: number;
  /** short-term loudness (3 s window), LUFS */
  s: number;
}

/** Short-term loudness over time (ffmpeg ebur128, one sample per 100 ms). */
export async function loudnessTimeline(abs: string): Promise<LoudnessPoint[]> {
  const { code, stderr } = await run(["-i", abs, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]);
  if (code !== 0) throw new Error(`loudness timeline failed: ${stderr.slice(-400)}`);
  const points: LoudnessPoint[] = [];
  for (const m of stderr.matchAll(/t:\s*([0-9.]+)\s+TARGET:[^M]*M:\s*(-?[0-9.]+)\s+S:\s*(-?[0-9.]+)/g)) {
    const t = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3]);
    if (Number.isFinite(t) && Number.isFinite(mm) && Number.isFinite(ss)) points.push({ t: +t.toFixed(2), m: mm, s: ss });
  }
  return points;
}
