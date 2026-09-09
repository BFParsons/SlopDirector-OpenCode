/**
 * Whisper transcription → caption files. Spawns the Python CLI to produce SRT +
 * VTT + JSON next to a temp dir, then reads the VTT/SRT back as strings and the
 * JSON for word/segment timings.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { whisperArgv } from "./binaries";
import { audioProjectDir } from "./workspace";
import { updateJob } from "./jobs";

export interface TranscriptWord {
  startS: number;
  endS: number;
  text: string;
}

export interface TranscriptSegment {
  startS: number;
  endS: number;
  text: string;
  /** per-word timings (whisper --word_timestamps) */
  words?: TranscriptWord[];
}

export interface TranscribeResult {
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
  /** every word with its timing, flattened across segments */
  words: TranscriptWord[];
  srt: string | null;
  vtt: string | null;
}

export interface WhisperOptions {
  /** tiny | base | small | medium | large-v3 — bigger = slower, more accurate. */
  model?: string;
  /** ISO code to force, or null to auto-detect. */
  language?: string | null;
}

// Whisper is the heaviest thing the app runs. Nine clip scouts asking for
// transcripts at once put eleven whisper processes on an 8-core laptop (load
// 67); now at most WHISPER_CONCURRENCY (default 2) run, the rest queue, and
// concurrent requests for the same file + model share one run.
const gw = globalThis as unknown as { __whisperInflight?: Map<string, Promise<TranscribeResult>>; __whisperSlots?: { active: number; waiters: (() => void)[] } };
const inflight = (gw.__whisperInflight ??= new Map<string, Promise<TranscribeResult>>());
const slots = (gw.__whisperSlots ??= { active: 0, waiters: [] });
const WHISPER_MAX = Math.max(1, Number(process.env.WHISPER_CONCURRENCY ?? 2) || 2);
async function acquireSlot(): Promise<void> {
  if (slots.active < WHISPER_MAX) {
    slots.active++;
    return;
  }
  await new Promise<void>((r) => slots.waiters.push(r));
  slots.active++;
}
function releaseSlot(): void {
  slots.active--;
  const next = slots.waiters.shift();
  if (next) next();
}

export async function runWhisper(projectId: string, inputAbs: string, opts: WhisperOptions, jobId: string): Promise<TranscribeResult> {
  const key = `${inputAbs}|${opts.model?.trim() || "base"}|${opts.language ?? ""}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const run = (async () => {
    await acquireSlot();
    try {
      return await runWhisperOnce(projectId, inputAbs, opts, jobId);
    } finally {
      releaseSlot();
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

async function runWhisperOnce(
  projectId: string,
  inputAbs: string,
  opts: WhisperOptions,
  jobId: string,
): Promise<TranscribeResult> {
  const model = opts.model?.trim() || "base";
  const projectRoot = audioProjectDir(projectId);
  const workDir = path.join(projectRoot, `.whisper-${jobId.slice(0, 8)}`);
  await mkdir(workDir, { recursive: true });

  const args = [...whisperArgv(), inputAbs, "--model", model, "--output_dir", workDir, "--output_format", "all", "--verbose", "False", "--word_timestamps", "True"];
  if (opts.language) args.push("--language", opts.language);

  updateJob(jobId, { message: `Transcribing with “${model}” model…` });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(args[0], args.slice(1), { env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let stderr = "";
    proc.stdout.on("data", () => {});
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      const m = d.toString().match(/(\d{1,3})%\|/g);
      if (m && m.length) {
        const pct = Number(m[m.length - 1].replace(/%\|/, ""));
        if (Number.isFinite(pct)) updateJob(jobId, { progress: Math.min(0.99, pct / 100), message: `Transcribing… ${pct}%` });
      }
    });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`whisper exited ${code}: ${stderr.slice(-600)}`))));
  });

  const files = await readdir(workDir).catch(() => []);
  const read = async (ext: string): Promise<string | null> => {
    const f = files.find((x) => x.endsWith(ext));
    if (!f) return null;
    return readFile(path.join(workDir, f), "utf8").catch(() => null);
  };

  const srt = await read(".srt");
  const vtt = await read(".vtt");
  const jsonRaw = await read(".json");

  let language: string | null = null;
  let text = "";
  let segments: TranscriptSegment[] = [];
  if (jsonRaw) {
    try {
      const j = JSON.parse(jsonRaw) as {
        language?: string;
        text?: string;
        segments?: {
          start: number;
          end: number;
          text: string;
          words?: { word: string; start: number; end: number }[];
        }[];
      };
      language = j.language ?? null;
      text = (j.text ?? "").trim();
      segments = (j.segments ?? []).map((s) => ({
        startS: s.start,
        endS: s.end,
        text: s.text.trim(),
        words: (s.words ?? []).map((w) => ({ startS: w.start, endS: w.end, text: w.word.trim() })),
      }));
    } catch {
      /* leave defaults */
    }
  }

  await rm(workDir, { recursive: true, force: true });
  const words = segments.flatMap((s) => s.words ?? []);
  return { language, text, segments, words, srt, vtt };
}
