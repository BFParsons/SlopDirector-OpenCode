import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Project } from "@prisma/client";
import type { JobType } from "@/lib/db/enums";
import { env } from "@/env";
import { getTtsModel } from "@/config/models";
import { prisma } from "@/lib/db/client";
import { buildCaptions } from "@/lib/render/captions";
import { asEffects } from "@/lib/render/effects";
import { asPip } from "@/lib/render/pip";
import { asTransform } from "@/lib/render/transform";
import {
  ASSET_ROOT,
  absolutePath,
  cleanupTmp,
  ensureProjectTmp,
  projectDir,
  saveAsset,
  saveAssetStream,
} from "@/lib/assets/storage";
import { fileToDataUri } from "@/lib/assets/serve";
import { assembleVideo, type OverlayInput, type VisualInput } from "@/lib/ffmpeg/assemble";
import type { TextOverlaySpec } from "@/lib/ffmpeg/args";
import { resolveEncoder } from "@/lib/system/capabilities";
import { aspectLabel, resolutionLabel } from "@/lib/ffmpeg/args";
import { frameSize } from "@/config/frame-sizes";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { generateScript } from "@/lib/llm/expand";
import type { BriefInput } from "@/lib/llm/prompts";
import { downloadYouTubeAudio, downloadYouTubeClip } from "@/lib/youtube/import";
import { parseYouTubeId } from "@/lib/youtube/url";
import { OpenRouterError } from "@/lib/openrouter/client";
import { synthesizeSpeech } from "@/lib/openrouter/tts";
import { keyForProject } from "@/lib/openrouter/userKey";
import {
  type FrameImage,
  getVideoStatus,
  openVideoContentStream,
  submitVideo,
} from "@/lib/openrouter/video";
import { emitProgress } from "./progressBus";
import { enqueue } from "./queue";
import {
  maybeEnqueueAssembly,
  setProjectStatus,
  setScriptGenStatus,
  setSegmentStatus,
  setVoStatus,
  touchProject,
} from "./orchestrator";

const RECONCILE_INTERVAL_MS = 30_000;
const MAX_RECONCILE_POLLS = 60; // ~30 min ceiling per segment

function briefFromProject(p: Project): BriefInput {
  return {
    title: p.title,
    goal: p.goal,
    subject: p.subject,
    tone: p.tone,
    targetLengthS: p.targetLengthS,
    aspectRatio: aspectLabel(p.aspectRatio),
    shotCount: p.shotCount,
  };
}

// ---------------------------------------------------------------------------
// GEN_SCRIPT — audio track: scriptFull + voScript
// ---------------------------------------------------------------------------
async function genScriptJob(payload: { projectId: string }): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: payload.projectId },
  });
  if (!project) throw new Error("project not found");

  const apiKey = await keyForProject(project.id);
  const result = await generateScript(
    project.llmModel,
    briefFromProject(project),
    { concept: project.concept },
    apiKey,
  );

  await prisma.project.update({
    where: { id: project.id },
    data: { scriptFull: result.scriptFull, voScript: result.voScript, error: null },
  });

  await setScriptGenStatus(project.id, "READY");
}

// ---------------------------------------------------------------------------
// GEN_STORYBOARD / GEN_IMAGE — removed in this fork (Storyboard mode and its
// keyframe image generation). The JobType enum still lists them (DB schema is
// unchanged), so a stale queued job fails loudly instead of silently vanishing.
// ---------------------------------------------------------------------------
function removedJob(type: string): never {
  throw new Error(`${type} jobs were removed in this fork (Storyboard mode)`);
}

// ---------------------------------------------------------------------------
// SUBMIT_SHOT — submit one AI/driver segment to the video provider
// ---------------------------------------------------------------------------
async function submitShotJob(payload: { segmentId: string }): Promise<void> {
  const segment = await prisma.segment.findUnique({
    where: { id: payload.segmentId },
    include: { project: true, refImage: true, sourceAsset: true },
  });
  if (!segment) throw new Error("segment not found");
  if (segment.status === "READY") return;
  const project = segment.project;

  // Image-to-video driver: an UPLOAD_IMAGE_DRIVER uses its uploaded photo;
  // an AI_GENERATED segment may carry an optional reference image.
  let frameImages: FrameImage[] | undefined;
  let inputReferences: string[] | undefined;
  const driver =
    segment.source === "UPLOAD_IMAGE_DRIVER" && segment.sourceAsset
      ? { asset: segment.sourceAsset, role: segment.refRole ?? "FIRST_FRAME" }
      : segment.refImage && segment.refRole
        ? { asset: segment.refImage, role: segment.refRole }
        : null;
  if (driver) {
    const dataUri = await fileToDataUri(driver.asset.path, driver.asset.mime);
    if (driver.role === "STYLE") {
      inputReferences = [dataUri];
    } else {
      frameImages = [
        { url: dataUri, frameType: driver.role === "LAST_FRAME" ? "last_frame" : "first_frame" },
      ];
    }
  }

  const callbackUrl = env.PUBLIC_BASE_URL
    ? `${env.PUBLIC_BASE_URL}/api/webhooks/openrouter`
    : undefined;

  const res = await submitVideo({
    model: segment.videoModel ?? project.videoModel,
    prompt: segment.prompt,
    durationS: segment.durationS,
    resolution: resolutionLabel(project.resolution),
    aspectRatio: aspectLabel(project.aspectRatio),
    frameImages,
    inputReferences,
    generateAudio: false,
    callbackUrl,
    apiKey: await keyForProject(project.id),
  });

  await setSegmentStatus(segment.id, "SUBMITTED", { providerJobId: res.id });
  await enqueue(
    "RECONCILE_VIDEO",
    { segmentId: segment.id, polls: 0 },
    { projectId: project.id, availableInMs: RECONCILE_INTERVAL_MS },
  );
}

// ---------------------------------------------------------------------------
// RECONCILE_VIDEO  (safety net; the only mechanism when no webhook URL)
// ---------------------------------------------------------------------------
async function reconcileVideoJob(payload: {
  segmentId: string;
  polls?: number;
}): Promise<void> {
  const segment = await prisma.segment.findUnique({
    where: { id: payload.segmentId },
  });
  if (!segment || !segment.providerJobId) return;
  if (segment.status === "READY" || segment.status === "DOWNLOADING") return;

  const polls = (payload.polls ?? 0) + 1;
  const status = await getVideoStatus(
    segment.providerJobId,
    await keyForProject(segment.projectId),
  );

  if (status.status === "completed") {
    await setSegmentStatus(segment.id, "DOWNLOADING");
    await enqueue("DOWNLOAD_CLIP", { segmentId: segment.id }, { projectId: segment.projectId });
    return;
  }
  if (status.status === "failed") {
    await setSegmentStatus(segment.id, "FAILED", {
      error: status.error ?? "provider reported failure",
    });
    return;
  }

  if (polls >= MAX_RECONCILE_POLLS) {
    await setSegmentStatus(segment.id, "FAILED", {
      error: "timed out waiting for provider",
    });
    return;
  }

  if (segment.status !== "RENDERING") await setSegmentStatus(segment.id, "RENDERING");
  await enqueue(
    "RECONCILE_VIDEO",
    { segmentId: segment.id, polls },
    { projectId: segment.projectId, availableInMs: RECONCILE_INTERVAL_MS },
  );
}

// ---------------------------------------------------------------------------
// DOWNLOAD_CLIP
// ---------------------------------------------------------------------------
async function downloadClipJob(payload: { segmentId: string }): Promise<void> {
  const segment = await prisma.segment.findUnique({
    where: { id: payload.segmentId },
  });
  if (!segment || !segment.providerJobId) throw new Error("segment/job missing");
  if (segment.status === "READY") return;

  const body = await openVideoContentStream(
    segment.providerJobId,
    0,
    await keyForProject(segment.projectId),
  );
  const asset = await saveAssetStream({
    projectId: segment.projectId,
    kind: "SHOT_CLIP",
    sub: "clips",
    filename: `${String(segment.index).padStart(2, "0")}-${segment.id}.mp4`,
    body,
    mime: "video/mp4",
  });

  // Probe the generated clip's real length so the timeline can cap re-extending
  // a trim, and clamp the requested duration to what actually rendered.
  const realDur = await probeDuration(absolutePath(asset.path));
  await setSegmentStatus(segment.id, "READY", {
    clipAssetId: asset.id,
    sourceDurationS: realDur > 0 ? realDur : null,
    durationS: realDur > 0 ? Math.min(segment.durationS, realDur) : segment.durationS,
  });
  await maybeEnqueueAssembly(segment.projectId);
}

// ---------------------------------------------------------------------------
// IMPORT_YOUTUBE — yt-dlp downloads + clips a section into a UPLOAD_VIDEO segment
// ---------------------------------------------------------------------------
async function importYoutubeJob(payload: { segmentId: string }): Promise<void> {
  const segment = await prisma.segment.findUnique({ where: { id: payload.segmentId } });
  if (!segment) throw new Error("segment not found");
  if (segment.status === "READY" && segment.sourceAssetId) return; // already imported
  if (!segment.importUrl) throw new Error("segment has no import URL");

  const videoId = parseYouTubeId(segment.importUrl);
  if (!videoId) throw new Error("invalid YouTube URL");
  const startS = segment.importStartS ?? 0;
  const endS = segment.importEndS ?? startS + 10;

  await setSegmentStatus(segment.id, "DOWNLOADING");

  const clip = await downloadYouTubeClip({
    videoId,
    startS,
    endS,
    timeoutMs: Math.min(10 * 60 * 1000, (endS - startS + 60) * 4000),
  });
  try {
    const buf = await readFile(clip.path);
    const asset = await saveAsset({
      projectId: segment.projectId,
      kind: "UPLOAD_VIDEO",
      sub: "uploads",
      filename: `yt-${segment.id}.mp4`,
      data: buf,
      mime: "video/mp4",
    });
    const probed = await probeDuration(absolutePath(asset.path));
    const realDur = probed > 0 ? probed : endS - startS;
    await setSegmentStatus(segment.id, "READY", {
      sourceAssetId: asset.id,
      durationS: Math.round(realDur * 10) / 10,
      sourceDurationS: realDur,
      error: null,
    });
    await touchProject(segment.projectId); // resync the DRAFT editor
  } finally {
    await rm(clip.tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// IMPORT_AUDIO — yt-dlp downloads + clips a section into an AudioOverlay
// ---------------------------------------------------------------------------
async function importAudioJob(payload: { overlayId: string }): Promise<void> {
  const overlay = await prisma.audioOverlay.findUnique({ where: { id: payload.overlayId } });
  if (!overlay) throw new Error("overlay not found");
  if (overlay.status === "READY" && overlay.assetId) return; // already imported

  const videoId = parseYouTubeId(overlay.sourceUrl);
  if (!videoId) throw new Error("invalid YouTube URL");
  const startS = overlay.importStartS;
  const endS = overlay.importEndS;

  await prisma.audioOverlay.update({
    where: { id: overlay.id },
    data: { status: "RUNNING", error: null },
  });

  const clip = await downloadYouTubeAudio({
    videoId,
    startS,
    endS,
    timeoutMs: Math.min(10 * 60 * 1000, (endS - startS + 60) * 4000),
  });
  try {
    const buf = await readFile(clip.path);
    const asset = await saveAsset({
      projectId: overlay.projectId,
      kind: "OVERLAY_AUDIO",
      sub: "overlays",
      filename: `yt-audio-${overlay.id}.mp3`,
      data: buf,
      mime: "audio/mpeg",
    });
    const durationS = await probeDuration(absolutePath(asset.path));
    await prisma.audioOverlay.update({
      where: { id: overlay.id },
      data: { status: "READY", assetId: asset.id, durationS, error: null },
    });
    await touchProject(overlay.projectId); // resync the DRAFT editor
  } finally {
    await rm(clip.tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// SYNTH_VO — TTS for TTS_FROM_SCRIPT / TTS_VERBATIM modes
// ---------------------------------------------------------------------------
async function synthVoJob(payload: { projectId: string }): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: payload.projectId },
  });
  if (!project) throw new Error("project not found");

  const input =
    project.audioMode === "TTS_VERBATIM" ? project.voVerbatim : project.voScript;
  if (!input || !input.trim()) {
    await setVoStatus(project.id, "FAILED", {
      error:
        project.audioMode === "TTS_VERBATIM"
          ? "no verbatim transcript"
          : "no voiceover script",
    });
    return;
  }

  await setVoStatus(project.id, "RUNNING");
  const voice = project.ttsVoice ?? getTtsModel(project.ttsModel)?.defaultVoice;
  const instructions = project.voDeliveryNotes ?? undefined;
  const apiKey = await keyForProject(project.id);

  let buf: Buffer;
  try {
    buf = await synthesizeSpeech({
      model: project.ttsModel,
      input,
      voice: voice ?? undefined,
      instructions,
      apiKey,
    });
  } catch (e) {
    // Not every TTS model accepts `instructions`; retry once without it.
    if (
      instructions &&
      e instanceof OpenRouterError &&
      e.status >= 400 &&
      e.status < 500
    ) {
      buf = await synthesizeSpeech({
        model: project.ttsModel,
        input,
        voice: voice ?? undefined,
        apiKey,
      });
    } else {
      throw e;
    }
  }

  const asset = await saveAsset({
    projectId: project.id,
    kind: "VO_AUDIO",
    sub: "vo",
    filename: "voiceover.mp3",
    data: buf,
    mime: "audio/mpeg",
  });
  const durationS = await probeDuration(absolutePath(asset.path));

  await setVoStatus(project.id, "READY", {
    assetId: asset.id,
    durationS,
    source: "SYNTHESIZED",
  });
  await maybeEnqueueAssembly(project.id);
}

// ---------------------------------------------------------------------------
// ASSEMBLE_FINAL
// ---------------------------------------------------------------------------
async function assembleFinalJob(payload: { projectId: string }): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: payload.projectId },
    include: {
      segments: {
        orderBy: { index: "asc" },
        include: { clipAsset: true, sourceAsset: true },
      },
      voiceover: { include: { asset: true } },
      musicAsset: true,
      watermarkAsset: true,
      audioOverlays: { include: { asset: true }, orderBy: { index: "asc" } },
      textOverlays: { orderBy: { index: "asc" } },
    },
  });
  if (!project) throw new Error("project not found");

  const adjustOf = (s: { brightness: number; contrast: number; saturation: number }) => ({
    brightness: s.brightness,
    contrast: s.contrast,
    saturation: s.saturation,
  });

  const toVisualInput = (s: (typeof project.segments)[number]): VisualInput => {
    if (s.source === "UPLOAD_IMAGE_STILL") {
      if (!s.sourceAsset) throw new Error(`segment ${s.index} has no image`);
      return {
        kind: "image",
        path: absolutePath(s.sourceAsset.path),
        durationS: s.durationS,
        motion: s.imageMotion,
        adjust: adjustOf(s),
        transform: asTransform(s.transform),
        effects: asEffects(s.effects),
      };
    }
    if (s.source === "UPLOAD_VIDEO") {
      if (!s.sourceAsset) throw new Error(`segment ${s.index} has no video`);
      return { kind: "video", path: absolutePath(s.sourceAsset.path), muted: s.muted, speed: s.speed, durationS: s.durationS, trimStartS: s.trimStartS, adjust: adjustOf(s), transform: asTransform(s.transform), effects: asEffects(s.effects) };
    }
    // AI_GENERATED / UPLOAD_IMAGE_DRIVER -> generated clip (no native audio)
    if (!s.clipAsset) throw new Error(`segment ${s.index} has no clip`);
    return { kind: "video", path: absolutePath(s.clipAsset.path), muted: s.muted, speed: s.speed, durationS: s.durationS, trimStartS: s.trimStartS, adjust: adjustOf(s), transform: asTransform(s.transform), effects: asEffects(s.effects) };
  };

  // V1 = the main contiguous sequence; V2 = positioned PiP overlays. Audio-only
  // clips carry no video and are mixed separately (below). Library clips live in
  // the Media Bucket only — never in the render.
  const inputs: VisualInput[] = project.segments
    .filter((s) => (s.track ?? 0) === 0 && !s.audioOnly && !s.library)
    .map(toVisualInput);
  // Any track >= 1 is a positioned overlay layer (V2, V3, …). Composite them
  // bottom-to-top by track index (then offset) so higher layers sit on top.
  const overlayClips: OverlayInput[] = project.segments
    .filter((s) => (s.track ?? 0) >= 1 && !s.audioOnly && !s.library)
    .sort((a, b) => (a.track ?? 0) - (b.track ?? 0) || (a.offsetS ?? 0) - (b.offsetS ?? 0))
    .map((s) => ({ ...toVisualInput(s), offsetS: s.offsetS ?? 0, pip: asPip(s.pip) }));

  // Audio-only clips (unlinked clip audio): an asset, trimmed to [in, in+dur],
  // placed at offsetS on the final timeline.
  const audioClips = project.segments
    .filter((s) => s.audioOnly && !s.library && s.sourceAsset)
    .map((s) => ({
      path: absolutePath(s.sourceAsset!.path),
      offsetS: s.offsetS ?? 0,
      trimStartS: s.trimStartS ?? 0,
      durationS: s.durationS,
      speed: s.speed ?? 1,
    }));

  const voPath =
    project.audioMode !== "NONE" && project.voiceover?.asset
      ? absolutePath(project.voiceover.asset.path)
      : undefined;

  // Music bed is offered for TTS/silent modes, not when an uploaded master track
  // already is the audio (UPLOAD_AUDIO) — matches what the UI exposes.
  const musicPath =
    project.musicAsset && project.audioMode !== "UPLOAD_AUDIO"
      ? absolutePath(project.musicAsset.path)
      : undefined;

  // Foreground audio overlays that finished downloading and are switched on.
  const overlays = project.audioOverlays
    .filter((o) => o.included && o.status === "READY" && o.asset)
    .map((o) => ({
      path: absolutePath(o.asset!.path),
      offsetS: o.offsetS,
      volume: o.volume,
    }));

  const { w, h } = frameSize(project);
  await ensureProjectTmp(project.id);
  // Bundle projects render into their own folder; legacy under ASSET_ROOT/<id>.
  const assetBase = project.bundlePath
    ? path.join(project.bundlePath, "assets")
    : projectDir(project.id);
  const tmpDir = path.join(assetBase, "tmp");
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, "final.mp4");
  const finalDir = path.join(assetBase, "final");
  await mkdir(finalDir, { recursive: true });
  const finalPath = path.join(finalDir, "final.mp4");

  // Optional logo/watermark composited over the whole video.
  const watermark = project.watermarkAsset
    ? {
        path: absolutePath(project.watermarkAsset.path),
        position: project.watermarkPosition,
        scale: project.watermarkScale,
        opacity: project.watermarkOpacity,
        margin: project.watermarkMargin,
      }
    : undefined;

  // Burned-in text overlays. Each non-empty overlay's literal text is written to
  // a tmp file (drawtext reads it with expansion disabled — no escaping needed).
  const textOverlays: TextOverlaySpec[] = [];
  for (const t of project.textOverlays) {
    if (!t.text.trim()) continue;
    const textfile = path.join(tmpDir, `text-${t.id}.txt`);
    await writeFile(textfile, t.text, "utf8");
    textOverlays.push({
      textfile,
      position: t.position,
      sizePct: t.sizePct,
      color: t.color,
      boxEnabled: t.boxEnabled,
      boxColor: t.boxColor,
      boxOpacity: t.boxOpacity,
      marginPx: t.marginPx,
      startS: t.startS,
      endS: t.endS,
      animation: t.animation,
    });
  }

  // Burned-in captions auto-generated from the voiceover script, timed across
  // the VO (falling back to the total visual duration when there's no VO).
  if (project.captionsEnabled) {
    const captionText =
      project.audioMode === "TTS_VERBATIM"
        ? (project.voVerbatim ?? "")
        : (project.voScript ?? project.voVerbatim ?? "");
    const segTotal = project.segments.reduce((a, s) => a + s.durationS, 0);
    const span =
      project.audioMode !== "NONE" && (project.voiceover?.durationS ?? 0) > 0
        ? (project.voiceover!.durationS as number)
        : segTotal;
    const cues = buildCaptions(captionText, span, {
      position: project.captionPosition,
      sizePct: project.captionSizePct,
      marginPx: 40,
    });
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      const textfile = path.join(tmpDir, `caption-${i}.txt`);
      await writeFile(textfile, c.text, "utf8");
      textOverlays.push({
        textfile,
        position: c.position as TextOverlaySpec["position"],
        sizePct: c.sizePct,
        color: c.color,
        boxEnabled: c.boxEnabled,
        boxColor: c.boxColor,
        boxOpacity: c.boxOpacity,
        marginPx: c.marginPx,
        startS: c.startS,
        endS: c.endS,
        animation: c.animation,
      });
    }
  }

  // Pick the encoder for this host (validated GPU encode if available, else x264).
  const encoder = await resolveEncoder();

  let lastPct = -5;
  const { durationS } = await assembleVideo({
    inputs,
    overlayClips,
    audioClips,
    encoder,
    voPath,
    voVolume: project.voMuted ? 0 : project.voVolume,
    musicPath,
    musicVolume: project.musicMuted ? 0 : project.musicVolume,
    musicDucking: project.musicDucking,
    overlays,
    colorLook: project.colorLook,
    transition: project.transition,
    transitionMs: project.transitionMs,
    audioNormalize: project.audioNormalize,
    fillMode: project.fillMode,
    vignette: project.vignette,
    grain: project.grain,
    audioFadeInS: project.audioFadeInS,
    audioFadeOutS: project.audioFadeOutS,
    watermark,
    textOverlays,
    width: w,
    height: h,
    audioFitMode: project.audioFitMode,
    outPath: finalPath,
    tmpPath,
    onProgress: (pct) => {
      emitProgress(project.id, { type: "assembly.progress", percent: pct });
      if (pct - lastPct >= 5 || pct === 100) {
        lastPct = pct;
        void prisma.finalRender
          .update({ where: { projectId: project.id }, data: { progress: pct } })
          .catch(() => {});
      }
    },
  });

  // Bundle projects store the final render's absolute path; legacy store relative.
  const relativePath = project.bundlePath ? finalPath : path.relative(ASSET_ROOT, finalPath);
  const st = await stat(finalPath);
  const asset = await prisma.asset.create({
    data: {
      projectId: project.id,
      kind: "FINAL_MP4",
      path: relativePath,
      mime: "video/mp4",
      sizeBytes: st.size,
    },
  });

  await prisma.finalRender.update({
    where: { projectId: project.id },
    data: { status: "READY", assetId: asset.id, durationS, progress: 100 },
  });
  await cleanupTmp(project.id);
  await setProjectStatus(project.id, "DONE");
  emitProgress(project.id, { type: "final.ready", assetId: asset.id });
}

// ---------------------------------------------------------------------------
// CLEANUP
// ---------------------------------------------------------------------------
async function cleanupJob(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stale = await prisma.project.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true },
  });
  for (const p of stale) {
    const { deleteProjectAssets } = await import("@/lib/assets/storage");
    await deleteProjectAssets(p.id);
    await prisma.project.delete({ where: { id: p.id } }).catch(() => {});
  }
  // Reschedule the next sweep.
  await enqueue("CLEANUP", {}, { availableInMs: 24 * 60 * 60 * 1000 });
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
type Handler = (payload: Record<string, unknown>) => Promise<void>;

export const handlers: Record<JobType, Handler> = {
  GEN_STORYBOARD: () => removedJob("GEN_STORYBOARD"),
  GEN_SCRIPT: (p) => genScriptJob(p as { projectId: string }),
  GEN_IMAGE: () => removedJob("GEN_IMAGE"),
  SUBMIT_SHOT: (p) => submitShotJob(p as { segmentId: string }),
  RECONCILE_VIDEO: (p) =>
    reconcileVideoJob(p as { segmentId: string; polls?: number }),
  DOWNLOAD_CLIP: (p) => downloadClipJob(p as { segmentId: string }),
  IMPORT_YOUTUBE: (p) => importYoutubeJob(p as { segmentId: string }),
  IMPORT_AUDIO: (p) => importAudioJob(p as { overlayId: string }),
  SYNTH_VO: (p) => synthVoJob(p as { projectId: string }),
  ASSEMBLE_FINAL: (p) => assembleFinalJob(p as { projectId: string }),
  CLEANUP: () => cleanupJob(),
};
