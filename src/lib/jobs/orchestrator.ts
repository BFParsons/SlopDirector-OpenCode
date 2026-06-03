import type {
  AdStatus,
  AudioMode,
  JobType,
  SegmentSource,
  ShotStatus,
  SimpleStatus,
} from "@/lib/db/enums";
import { prisma } from "@/lib/db/client";
import { emitProgress } from "./progressBus";
import { enqueue } from "./queue";

/** Segments that require a video-provider call (everything else is READY on upload). */
export function isAiSegment(source: SegmentSource): boolean {
  return source === "AI_GENERATED" || source === "UPLOAD_IMAGE_DRIVER";
}

/**
 * An AI/driver segment that still needs (re)generating. A segment already READY
 * with a clip is reused on a re-render — no provider call, no cost. This is the
 * single source of truth for "what will be billed", shared by startRender and
 * the cost preview so they cannot drift.
 */
export function aiSegmentNeedsRender(s: {
  source: SegmentSource;
  status: ShotStatus;
  clipAssetId: string | null;
}): boolean {
  return isAiSegment(s.source) && !(s.status === "READY" && !!s.clipAssetId);
}

/** True for the TTS audio modes (voiceover synthesized from text). */
export function isTtsMode(audioMode: AudioMode): boolean {
  return audioMode === "TTS_FROM_SCRIPT" || audioMode === "TTS_VERBATIM";
}

/** Whether a render must synthesize the voiceover (vs. reuse a ready one). */
export function voNeedsSynth(
  audioMode: AudioMode,
  voiceover: { status: SimpleStatus; assetId: string | null } | null | undefined,
): boolean {
  const voReady = voiceover?.status === "READY" && !!voiceover.assetId;
  return isTtsMode(audioMode) && !voReady;
}

export async function setProjectStatus(
  projectId: string,
  status: AdStatus,
  error?: string | null,
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { status, error: error ?? null },
  });
  emitProgress(projectId, { type: "project.status", status, error: error ?? null });
}

/**
 * Bump the project's updatedAt so the client editor (keyed on it) remounts and
 * reseeds from a fresh snapshot. Used when background work outside an active
 * render changes a segment — e.g. a YouTube import finishing in DRAFT.
 */
export async function touchProject(projectId: string): Promise<void> {
  await prisma.project
    .update({ where: { id: projectId }, data: { updatedAt: new Date() } })
    .catch(() => {});
}

export async function failProject(
  projectId: string,
  error: string,
): Promise<void> {
  const message = error.slice(0, 2000);
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "FAILED", error: message },
  });
  emitProgress(projectId, { type: "error", scope: "project", message });
  emitProgress(projectId, { type: "project.status", status: "FAILED", error: message });
}

export async function setSegmentStatus(
  segmentId: string,
  status: ShotStatus,
  extra: {
    error?: string | null;
    clipAssetId?: string | null;
    providerJobId?: string | null;
    sourceAssetId?: string | null;
    durationS?: number;
    sourceDurationS?: number | null;
  } = {},
) {
  const segment = await prisma.segment.update({
    where: { id: segmentId },
    data: { status, ...extra },
  });
  emitProgress(segment.projectId, {
    type: "segment.status",
    segmentId,
    index: segment.index,
    status,
    error: extra.error ?? null,
  });
  return segment;
}

export async function setVoStatus(
  projectId: string,
  status: SimpleStatus,
  extra: {
    error?: string | null;
    assetId?: string | null;
    durationS?: number | null;
    source?: "SYNTHESIZED" | "UPLOADED";
  } = {},
): Promise<void> {
  await prisma.voiceoverAsset.update({
    where: { projectId },
    data: { status, ...extra },
  });
  emitProgress(projectId, { type: "vo.status", status, error: extra.error ?? null });
}

export async function setVisualGenStatus(
  projectId: string,
  status: SimpleStatus,
  error?: string | null,
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { visualGenStatus: status },
  });
  emitProgress(projectId, { type: "visual.gen", status, error: error ?? null });
}

export async function setScriptGenStatus(
  projectId: string,
  status: SimpleStatus,
  error?: string | null,
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { scriptGenStatus: status },
  });
  emitProgress(projectId, { type: "script.gen", status, error: error ?? null });
}

/**
 * Kick off the full render. The visual and audio tracks are independent:
 *  - AI/driver segments get a SUBMIT_SHOT chain; uploaded segments are READY now.
 *  - Audio follows `audioMode`: TTS modes enqueue SYNTH_VO; UPLOAD_AUDIO is
 *    already READY; NONE has no audio row.
 * A final maybeEnqueueAssembly() handles the zero-AI-jobs case (all uploads).
 */
export async function startRender(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { segments: true, voiceover: true },
  });
  if (!project) throw new Error("project not found");

  // --- Audio track ---
  // Reuse an already-synthesized voiceover so re-rendering doesn't re-run (and
  // re-bill) TTS for an unchanged script.
  const needSynth = voNeedsSynth(project.audioMode, project.voiceover);
  if (needSynth) {
    await prisma.voiceoverAsset.upsert({
      where: { projectId },
      create: { projectId, status: "PENDING", source: "SYNTHESIZED" },
      update: {
        status: "PENDING",
        source: "SYNTHESIZED",
        error: null,
        assetId: null,
        durationS: null,
      },
    });
  } else if (project.audioMode === "NONE") {
    await prisma.voiceoverAsset
      .delete({ where: { projectId } })
      .catch(() => {}); // no row -> fine
  }
  // UPLOAD_AUDIO: the VoiceoverAsset is already READY (set at upload time).

  // --- Final render row ---
  await prisma.finalRender.upsert({
    where: { projectId },
    create: { projectId, status: "PENDING" },
    update: {
      status: "PENDING",
      error: null,
      assetId: null,
      durationS: null,
      progress: 0,
    },
  });

  // --- Visual track ---
  // Re-submit only AI segments that aren't already rendered — reusing existing
  // clips avoids re-billing shots that succeeded on a previous render. Uploaded
  // segments are READY immediately (no provider call).
  const aiToRender = project.segments.filter(aiSegmentNeedsRender);
  // Force-READY only uploaded segments that actually have a file. An in-flight
  // YouTube import (UPLOAD_VIDEO with no sourceAsset yet) is left untouched.
  const uploadSegments = project.segments.filter(
    (s) => !isAiSegment(s.source) && !!s.sourceAssetId,
  );
  if (aiToRender.length > 0) {
    await prisma.segment.updateMany({
      where: { id: { in: aiToRender.map((s) => s.id) } },
      data: {
        status: "PENDING",
        error: null,
        providerJobId: null,
        clipAssetId: null,
        attempts: 0,
      },
    });
  }
  if (uploadSegments.length > 0) {
    await prisma.segment.updateMany({
      where: { id: { in: uploadSegments.map((s) => s.id) } },
      data: { status: "READY", error: null },
    });
  }

  await setProjectStatus(projectId, "RENDERING");

  for (const s of aiToRender) {
    await enqueue("SUBMIT_SHOT", { segmentId: s.id }, { projectId });
  }
  if (needSynth) {
    await enqueue("SYNTH_VO", { projectId }, { projectId });
  }

  // Covers the case where nothing needed (re)generating (all reused/uploaded).
  await maybeEnqueueAssembly(projectId);
}

/**
 * Enqueue final assembly exactly once, when every segment is READY and the
 * audio track is ready for the chosen mode. The atomic PENDING->RUNNING claim
 * guarantees a single enqueue even if several completions race here.
 */
export async function maybeEnqueueAssembly(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { segments: true, voiceover: true },
  });
  if (!project) return;
  // Only assemble during an active render — prevents a late reconcile/download
  // from auto-assembling a project the user cancelled back to DRAFT.
  if (project.status !== "RENDERING") return;

  const visualReady =
    project.segments.length > 0 &&
    project.segments.every((s) => s.status === "READY");
  const audioReady =
    project.audioMode === "NONE" || project.voiceover?.status === "READY";
  if (!visualReady || !audioReady) return;

  const claimed = await prisma.finalRender.updateMany({
    where: { projectId, status: "PENDING" },
    data: { status: "RUNNING" },
  });
  if (claimed.count !== 1) return; // someone else already claimed assembly

  // Status stays RENDERING; assembly progress is surfaced via finalRender.progress.
  await enqueue("ASSEMBLE_FINAL", { projectId }, { projectId });
}

/**
 * When a job exhausts its retries, reflect the failure into the domain so the
 * UI shows it (and the user can retry the unit).
 */
export async function markJobFailure(
  job: { type: JobType; payload: unknown },
  error: string,
): Promise<void> {
  const p = (job.payload ?? {}) as { projectId?: string; segmentId?: string };
  try {
    switch (job.type) {
      case "GEN_STORYBOARD":
        if (p.projectId) await setVisualGenStatus(p.projectId, "FAILED", error);
        break;
      case "GEN_SCRIPT":
        if (p.projectId) await setScriptGenStatus(p.projectId, "FAILED", error);
        break;
      case "GEN_IMAGE": {
        // Surface image-gen failure on whichever target was set (error field only,
        // so the storyboard board / element library can show it).
        const tg = job.payload as {
          targetSegmentId?: string;
          targetElementId?: string;
          targetVariantId?: string;
        };
        const msg = error.slice(0, 2000);
        if (tg.targetSegmentId) {
          await prisma.segment.updateMany({ where: { id: tg.targetSegmentId }, data: { error: msg } }).catch(() => {});
        } else if (tg.targetElementId) {
          await prisma.storyElement.updateMany({ where: { id: tg.targetElementId }, data: { error: msg } }).catch(() => {});
        } else if (tg.targetVariantId) {
          await prisma.storyElementVariant.updateMany({ where: { id: tg.targetVariantId }, data: { error: msg } }).catch(() => {});
        }
        if (p.projectId) await touchProject(p.projectId);
        break;
      }
      case "SYNTH_VO":
        if (p.projectId) await setVoStatus(p.projectId, "FAILED", { error });
        break;
      case "SUBMIT_SHOT":
      case "DOWNLOAD_CLIP":
      case "RECONCILE_VIDEO":
        if (p.segmentId) await setSegmentStatus(p.segmentId, "FAILED", { error });
        break;
      case "IMPORT_YOUTUBE":
        if (p.segmentId) {
          const seg = await setSegmentStatus(p.segmentId, "FAILED", { error });
          await touchProject(seg.projectId); // resync the DRAFT editor
        }
        break;
      case "IMPORT_AUDIO": {
        const overlayId = (job.payload as { overlayId?: string }).overlayId;
        if (overlayId) {
          const ov = await prisma.audioOverlay
            .update({
              where: { id: overlayId },
              data: { status: "FAILED", error: error.slice(0, 2000) },
            })
            .catch(() => null);
          if (ov) await touchProject(ov.projectId); // resync the DRAFT editor
        }
        break;
      }
      case "ASSEMBLE_FINAL":
        if (p.projectId) {
          await prisma.finalRender.updateMany({
            where: { projectId: p.projectId },
            data: { status: "FAILED", error: error.slice(0, 2000) },
          });
          await failProject(p.projectId, error);
        }
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("[orchestrator] markJobFailure error:", e);
  }
}
