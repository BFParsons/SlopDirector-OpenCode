/**
 * Eval harness for agent-driven editing.
 *
 * A task = a media setup + a scorer. The default solver is the *reference*
 * solution written against the HTTP API (proving the API is sufficient for
 * the task); plug an agent in by giving `run` a different `solve`. Scores come
 * from ffprobe and the perception endpoints, never from eyeballing.
 *
 *   BASE_URL=http://127.0.0.1:38473 pnpm test:eval
 *   SLOPSTUDIO_API_TOKEN=… for a token-protected server
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export const BASE = process.env.BASE_URL ?? "http://127.0.0.1:38473";
export const TMP = path.resolve("tests/eval/.tmp");

export interface Api {
  get<T = unknown>(p: string): Promise<T>;
  post<T = unknown>(p: string, body?: unknown): Promise<T>;
  patch<T = unknown>(p: string, body?: unknown): Promise<T>;
  del<T = unknown>(p: string): Promise<T>;
  upload<T = unknown>(p: string, file: string, fields: Record<string, string>): Promise<T>;
  bytes(p: string): Promise<Buffer>;
}

export function makeApi(): Api {
  const base: Record<string, string> = { "X-Requested-With": "spotforge", "X-Slop-Client": "eval-harness" };
  if (process.env.SLOPSTUDIO_API_TOKEN) base.Authorization = `Bearer ${process.env.SLOPSTUDIO_API_TOKEN}`;
  async function call<T>(method: string, p: string, body?: unknown, form?: FormData): Promise<T> {
    const res = await fetch(BASE + p, {
      method,
      headers: form ? base : body !== undefined ? { ...base, "Content-Type": "application/json" } : base,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const json = (await res.json().catch(() => ({ error: `non-JSON ${res.status}` }))) as { data?: T; error?: string };
    if (!res.ok || json.error) throw new Error(`${method} ${p} → ${res.status}: ${json.error ?? "?"}`);
    return json.data as T;
  }
  return {
    get: (p) => call("GET", p),
    post: (p, body) => call("POST", p, body),
    patch: (p, body) => call("PATCH", p, body),
    del: (p) => call("DELETE", p),
    upload: async (p, file, fields) => {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      form.append("file", new Blob([await readFile(file)]), path.basename(file));
      return call("POST", p, undefined, form);
    },
    bytes: async (p) => {
      const res = await fetch(BASE + p, { headers: base });
      if (!res.ok) throw new Error(`GET ${p} → ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// ---------------------------------------------------------------------------
// Project helpers (thin wrappers over the routes an agent would call)
// ---------------------------------------------------------------------------
export interface Snapshot {
  id: string;
  title: string;
  status: string;
  segments: { id: string; index: number; source: string; durationS: number; trimStartS: number; sourceAssetId: string | null; muted: boolean }[];
  finalRender: { status: string; progress: number; assetId: string | null; draftAssetId: string | null; durationS: number | null; error: string | null } | null;
}

export async function createProject(api: Api, title: string, w = 640, h = 360): Promise<string> {
  const p = await api.post<{ id: string }>("/api/projects", {
    title, targetLengthS: 30, aspectRatio: "R16_9", resolution: "R480P", frameWidth: w, frameHeight: h,
    shotCount: 5, audioMode: "NONE", llmModel: "google/gemini-3.5-flash", videoModel: "alibaba/wan-2.7",
    ttsModel: "x-ai/grok-voice-tts-1.0",
  });
  return p.id;
}

export async function uploadAsset(api: Api, projectId: string, file: string): Promise<string> {
  const a = await api.upload<{ id: string }>("/api/uploads", file, { projectId });
  return a.id;
}

export async function addVideoSegment(
  api: Api,
  projectId: string,
  assetId: string,
  opts: { trimStartS?: number; durationS?: number } = {},
): Promise<Snapshot> {
  return api.post<Snapshot>(`/api/projects/${projectId}/segments`, {
    source: "UPLOAD_VIDEO", sourceAssetId: assetId, ...(opts.durationS != null ? { durationS: opts.durationS } : {}),
    ...(opts.trimStartS != null ? { trimStartS: opts.trimStartS } : {}),
  });
}

export const snapshot = (api: Api, id: string) => api.get<Snapshot>(`/api/projects/${id}`);

/** Start a draft (or final) render and wait for it. Returns the snapshot + wall time. */
export async function render(api: Api, projectId: string, draft = true, timeoutS = 180): Promise<{ snap: Snapshot; ms: number }> {
  const before = await snapshot(api, projectId);
  const prevDraft = before.finalRender?.draftAssetId ?? null;
  const t0 = Date.now();
  await api.post(`/api/projects/${projectId}/render`, draft ? { draft: true } : {});
  for (;;) {
    await new Promise((r) => setTimeout(r, 400));
    const snap = await snapshot(api, projectId);
    const fr = snap.finalRender;
    if (snap.status === "FAILED") throw new Error(`render failed: ${snap.finalRender?.error ?? "?"}`);
    if (draft ? fr?.draftAssetId && fr.draftAssetId !== prevDraft && snap.status !== "RENDERING" : snap.status === "DONE" && fr?.status === "READY") {
      return { snap, ms: Date.now() - t0 };
    }
    if (Date.now() - t0 > timeoutS * 1000) throw new Error("render timed out");
  }
}

export async function downloadDraft(api: Api, projectId: string, to: string): Promise<string> {
  await writeFile(to, await api.bytes(`/api/projects/${projectId}/draft`));
  return to;
}

// ---------------------------------------------------------------------------
// Media generation + probing
// ---------------------------------------------------------------------------
export async function ffprobe(file: string): Promise<{ durationS: number; width: number; height: number; hasAudio: boolean }> {
  const { stdout } = await execFileP("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file]);
  const j = JSON.parse(stdout) as { format: { duration: string }; streams: { codec_type: string; width?: number; height?: number }[] };
  const v = j.streams.find((s) => s.codec_type === "video");
  return { durationS: Number(j.format.duration), width: v?.width ?? 0, height: v?.height ?? 0, hasAudio: j.streams.some((s) => s.codec_type === "audio") };
}

/** Video + a tone that pauses: tone 3 s, silence 2 s, tone 3 s, silence 2 s, tone 3 s (13 s). */
export async function genToneWithGaps(out: string): Promise<string> {
  await mkdir(path.dirname(out), { recursive: true });
  const tone = "between(mod(t,5),0,3)"; // on for 3 s of every 5 s
  await execFileP("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-t", "13", "-af", `volume='if(${tone},1,0)':eval=frame`,
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out,
  ]);
  return out;
}

/** Four visually distinct 3 s scenes (12 s): hard cuts at 3, 6, 9 s. */
export async function genScenes(out: string): Promise<string> {
  await mkdir(path.dirname(out), { recursive: true });
  const srcs = ["testsrc2=size=640x360:rate=30", "smptebars=size=640x360:rate=30", "color=c=0x2266cc:size=640x360:rate=30", "mandelbrot=size=640x360:rate=30"];
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  for (const s of srcs) args.push("-f", "lavfi", "-t", "3", "-i", s);
  args.push("-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000");
  args.push("-filter_complex", "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]", "-map", "[v]", "-map", "4:a", "-t", "12",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out);
  await execFileP("ffmpeg", args);
  return out;
}

// ---------------------------------------------------------------------------
// Task contract
// ---------------------------------------------------------------------------
export interface TaskResult {
  pass: boolean;
  metrics: Record<string, number | string | boolean>;
  notes?: string;
}
export interface Task {
  name: string;
  /** what the task asks an agent to do (the prompt an MCP-driven run would get) */
  brief: string;
  run(api: Api, ctx: { tmp: string; cleanup: (projectId: string) => void }): Promise<TaskResult>;
}
export const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
