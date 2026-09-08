/**
 * HTTP client the MCP server uses to talk to a running SlopStudio (desktop app
 * or `pnpm serve:headless`). SLOPSTUDIO_URL picks the server (default the
 * desktop port); SLOPSTUDIO_API_TOKEN adds bearer auth for non-desktop mode.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export const BASE = (process.env.SLOPSTUDIO_URL ?? "http://127.0.0.1:38473").replace(/\/$/, "");
const CLIENT_ID = `mcp-${process.pid}`;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { "X-Requested-With": "spotforge", "X-Slop-Client": CLIENT_ID, ...extra };
  if (process.env.SLOPSTUDIO_API_TOKEN) h.Authorization = `Bearer ${process.env.SLOPSTUDIO_API_TOKEN}`;
  return h;
}

const MIME: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska", webm: "video/webm", avi: "video/x-msvideo",
  ts: "video/mp2t", mts: "video/mp2t", mpg: "video/mpeg", mpeg: "video/mpeg", "3gp": "video/3gpp",
  wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac", opus: "audio/ogg",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  cube: "text/plain", srt: "text/plain", vtt: "text/vtt", txt: "text/plain",
};
/** MIME type from the extension — the API's stricter routes (music, LUT) refuse untyped uploads. */
export function mimeFor(file: string): string {
  return MIME[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, p: string, body?: unknown, form?: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + p, {
      method,
      headers: form ? headers() : body !== undefined ? headers({ "Content-Type": "application/json" }) : headers(),
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    throw new ApiError(
      `Cannot reach SlopStudio at ${BASE} (${(e as Error).message}). Start the desktop app or run \`pnpm serve:headless\`, or set SLOPSTUDIO_URL.`,
      0,
    );
  }
  const json = (await res.json().catch(() => ({ error: `non-JSON response (${res.status})` }))) as { data?: T; error?: string | null };
  if (!res.ok || json.error) throw new ApiError(`${method} ${p} → ${res.status}: ${json.error ?? "request failed"}`, res.status);
  return json.data as T;
}

export const api = {
  get: <T = unknown>(p: string) => call<T>("GET", p),
  post: <T = unknown>(p: string, body?: unknown) => call<T>("POST", p, body),
  patch: <T = unknown>(p: string, body?: unknown) => call<T>("PATCH", p, body),
  put: <T = unknown>(p: string, body?: unknown) => call<T>("PUT", p, body),
  del: <T = unknown>(p: string) => call<T>("DELETE", p),
  /** multipart upload of a local file under the `file` field (+ extra fields) */
  upload: async <T = unknown>(p: string, file: string, fields: Record<string, string> = {}) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    const abs = path.resolve(file);
    form.append("file", new Blob([await readFile(abs)], { type: mimeFor(abs) }), path.basename(abs));
    return call<T>("POST", p, undefined, form);
  },
  /** raw bytes (images, media) */
  bytes: async (p: string): Promise<{ bytes: Buffer; contentType: string; headers: Headers }> => {
    let res: Response;
    try {
      res = await fetch(BASE + p, { headers: headers() });
    } catch (e) {
      throw new ApiError(`Cannot reach SlopStudio at ${BASE} (${(e as Error).message})`, 0);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(`GET ${p} → ${res.status}: ${text.slice(0, 200)}`, res.status);
    }
    return { bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream", headers: res.headers };
  },
};

// ---------------------------------------------------------------------------
// Shapes (the subset of the project snapshot the tools read)
// ---------------------------------------------------------------------------
export interface Segment {
  id: string;
  index: number;
  title: string | null;
  source: string;
  status: string;
  track: number;
  audioOnly: boolean;
  library: boolean;
  offsetS: number;
  trimStartS: number;
  durationS: number;
  sourceDurationS: number | null;
  speed: number;
  muted: boolean;
  sourceAssetId: string | null;
  clipAssetId: string | null;
  effects: { kind: string; enabled?: boolean }[] | null;
  transform: unknown;
  pip: unknown;
  error: string | null;
}
export interface Snapshot {
  id: string;
  title: string;
  status: string;
  error: string | null;
  aspectRatio: string;
  resolution: string;
  frameWidth: number | null;
  frameHeight: number | null;
  exportCodec: string;
  audioMode: string;
  colorLook: string;
  transition: string;
  transitionMs: number;
  fillMode: string;
  captionsEnabled: boolean;
  captionStyle: string;
  lutAssetId: string | null;
  musicAssetId: string | null;
  musicVolume: number;
  voScript: string | null;
  segments: Segment[];
  textOverlays: { id: string; text: string; position: string; startS: number; endS: number | null }[];
  audioOverlays: { id: string; label: string | null; assetId: string | null; offsetS: number; volume: number; included: boolean; status: string; durationS: number | null }[];
  voiceover: { status: string; assetId: string | null; durationS: number | null } | null;
  finalRender: {
    status: string;
    progress: number;
    assetId: string | null;
    durationS: number | null;
    error: string | null;
    draftAssetId: string | null;
    draftUpdatedAt: string | null;
  } | null;
  updatedAt: string;
}

const PRESET_FRAMES: Record<string, Record<string, [number, number]>> = {
  R16_9: { R480P: [854, 480], R720P: [1280, 720], R1080P: [1920, 1080] },
  R9_16: { R480P: [480, 854], R720P: [720, 1280], R1080P: [1080, 1920] },
  R1_1: { R480P: [480, 480], R720P: [720, 720], R1080P: [1080, 1080] },
};

/** The compact, agent-friendly view of a project (what get_project returns). */
export function summarize(p: Snapshot) {
  const frame =
    p.frameWidth && p.frameHeight
      ? { w: p.frameWidth, h: p.frameHeight }
      : { w: PRESET_FRAMES[p.aspectRatio]?.[p.resolution]?.[0] ?? null, h: PRESET_FRAMES[p.aspectRatio]?.[p.resolution]?.[1] ?? null };
  const main = p.segments.filter((s) => s.track === 0 && !s.audioOnly && !s.library);
  const timelineS = +main.reduce((a, s) => a + s.durationS, 0).toFixed(3);
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    error: p.error,
    frame,
    exportCodec: p.exportCodec,
    audioMode: p.audioMode,
    look: { colorLook: p.colorLook, lutAssetId: p.lutAssetId, transition: p.transition, transitionMs: p.transitionMs, fillMode: p.fillMode },
    captions: { enabled: p.captionsEnabled, style: p.captionStyle },
    music: p.musicAssetId ? { assetId: p.musicAssetId, volume: p.musicVolume } : null,
    voiceover: p.voiceover,
    timelineDurationS: timelineS,
    segments: p.segments.map((s) => ({
      id: s.id,
      index: s.index,
      track: s.track,
      source: s.source,
      status: s.status,
      audioOnly: s.audioOnly,
      library: s.library,
      sourceAssetId: s.sourceAssetId,
      clipAssetId: s.clipAssetId,
      trimStartS: s.trimStartS,
      durationS: s.durationS,
      sourceDurationS: s.sourceDurationS,
      speed: s.speed,
      muted: s.muted,
      offsetS: s.offsetS,
      effects: (s.effects ?? []).filter((e) => e.enabled !== false).map((e) => e.kind),
      hasTransform: !!s.transform,
      pip: s.pip ?? null,
      error: s.error,
    })),
    textOverlays: p.textOverlays,
    audioOverlays: p.audioOverlays.map((a) => ({ id: a.id, label: a.label, assetId: a.assetId, offsetS: a.offsetS, volume: a.volume, included: a.included, status: a.status, durationS: a.durationS })),
    finalRender: p.finalRender,
    updatedAt: p.updatedAt,
  };
}

export const snapshot = (id: string) => api.get<Snapshot>(`/api/projects/${id}`);

export interface AssetInfo {
  id: string;
  projectId: string;
  kind: string;
  mime: string;
  sizeBytes: number;
  durationS: number;
  video: { codec: string; width: number; height: number; pixFmt: string } | null;
  path: string;
}
export const assetInfo = (id: string) => api.get<AssetInfo>(`/api/assets/${id}/info`);

/**
 * Poll until a render (draft or final) finishes, or until `maxWaitS` passes —
 * MCP clients time a single request out at ~60 s, so a blocking tool must
 * hand back before that and let the caller poll render_status. Returns
 * `null` when the render is still running.
 */
export const MAX_TOOL_WAIT_S = 50;
export async function waitForRender(projectId: string, draft: boolean, maxWaitS: number, prevDraft: string | null): Promise<Snapshot | null> {
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 500));
    const s = await snapshot(projectId);
    const fr = s.finalRender;
    if (s.status === "FAILED") throw new ApiError(`render failed: ${fr?.error ?? s.error ?? "unknown error"}`, 500);
    if (draft) {
      if (fr?.draftAssetId && fr.draftAssetId !== prevDraft && s.status !== "RENDERING") return s;
    } else if (s.status === "DONE" && fr?.status === "READY" && fr.assetId) {
      return s;
    }
    if (Date.now() - t0 > Math.min(maxWaitS, MAX_TOOL_WAIT_S) * 1000) return null;
  }
}
