import { orFetch, orJson } from "./client";

/** One exact-frame driver. `url` may be a public URL or a data URI. */
export interface FrameImage {
  url: string;
  frameType: "first_frame" | "last_frame";
}

export interface SubmitVideoOpts {
  model: string;
  prompt: string;
  durationS?: number;
  resolution?: string; // "480p" | "720p" | "1080p" | ...
  aspectRatio?: string; // "16:9" | "9:16" | "1:1" | ...
  /** Image-to-video first/last frame drivers. */
  frameImages?: FrameImage[];
  /** Style/identity reference images, as data URIs or public URLs. */
  inputReferences?: string[];
  generateAudio?: boolean;
  seed?: number;
  callbackUrl?: string;
  /** Per-user OpenRouter key; falls back to the server key when omitted. */
  apiKey?: string;
}

/** OpenRouter video API image-content shape: { type, image_url:{url}, frame_type? }. */
function imageContent(url: string, frameType?: "first_frame" | "last_frame") {
  const c: Record<string, unknown> = { type: "image_url", image_url: { url } };
  if (frameType) c.frame_type = frameType;
  return c;
}

export interface SubmitVideoResult {
  id: string;
  pollingUrl?: string;
  status?: string;
}

/** Submit an async video generation job. Returns the provider job id. */
export async function submitVideo(
  opts: SubmitVideoOpts,
): Promise<SubmitVideoResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    prompt: opts.prompt,
  };
  if (opts.durationS) body.duration = opts.durationS;
  if (opts.resolution) body.resolution = opts.resolution;
  if (opts.aspectRatio) body.aspect_ratio = opts.aspectRatio;
  if (opts.frameImages?.length)
    body.frame_images = opts.frameImages.map((f) => imageContent(f.url, f.frameType));
  if (opts.inputReferences?.length)
    body.input_references = opts.inputReferences.map((url) => imageContent(url));
  if (opts.generateAudio !== undefined) body.generate_audio = opts.generateAudio;
  if (opts.seed !== undefined) body.seed = opts.seed;
  if (opts.callbackUrl) body.callback_url = opts.callbackUrl;

  const json = await orJson<{
    id: string;
    polling_url?: string;
    status?: string;
  }>(
    "/videos",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { apiKey: opts.apiKey },
  );

  if (!json.id) throw new Error("OpenRouter video submit returned no job id");
  return { id: json.id, pollingUrl: json.polling_url, status: json.status };
}

export type VideoJobStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | string;

export interface VideoStatusResult {
  status: VideoJobStatus;
  unsignedUrls?: string[];
  error?: string;
  raw: unknown;
}

export async function getVideoStatus(
  jobId: string,
  apiKey?: string,
): Promise<VideoStatusResult> {
  const json = await orJson<{
    status: string;
    unsigned_urls?: string[];
    error?: string | { message?: string };
  }>(`/videos/${encodeURIComponent(jobId)}`, undefined, { apiKey });

  const error =
    typeof json.error === "string" ? json.error : json.error?.message;

  return {
    status: json.status,
    unsignedUrls: json.unsigned_urls,
    error,
    raw: json,
  };
}

/**
 * Open the generated video as a stream for a completed job. The caller pipes
 * `body` straight to disk (see `saveAssetStream`) so the clip is never fully
 * resident in memory — clips can be hundreds of MB and several download at once.
 */
export async function openVideoContentStream(
  jobId: string,
  index = 0,
  apiKey?: string,
): Promise<ReadableStream<Uint8Array>> {
  const res = await orFetch(
    `/videos/${encodeURIComponent(jobId)}/content?index=${index}`,
    {},
    { timeoutMs: 300_000, apiKey },
  );
  if (!res.body) throw new Error("Video content download had no response body");
  return res.body;
}

export async function listVideoModels(apiKey?: string): Promise<unknown[]> {
  const json = await orJson<{ data?: unknown[]; models?: unknown[] }>(
    "/videos/models",
    undefined,
    { apiKey },
  );
  if (Array.isArray(json)) return json;
  return json.data ?? json.models ?? [];
}
