/**
 * Server-side edit checkpoints. A checkpoint captures the *editable* project
 * state — settings, segments, text + audio overlays — as JSON; restoring it
 * puts those rows back exactly (same ids), leaving media assets and renders
 * untouched. Lets an agent try an edit and roll back without the browser's
 * undo stack, and gives a person a "restore to before the bot" button.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export const CHECKPOINT_VERSION = 1;
export const MAX_CHECKPOINTS_PER_PROJECT = 50;

/** Project scalar fields a checkpoint carries (everything the editor can change). */
const PROJECT_FIELDS = [
  "title", "goal", "subject", "tone", "targetLengthS", "aspectRatio", "resolution",
  "frameWidth", "frameHeight", "exportCodec", "audioFitMode", "shotCount", "stylePrompt",
  "styleAnchorAssetId", "styleStrength", "audioNormalize", "colorLook", "transition",
  "transitionMs", "fillMode", "vignette", "grain", "audioFadeInS", "audioFadeOutS",
  "captionsEnabled", "captionPosition", "captionSizePct", "captionStyle",
  "watermarkAssetId", "watermarkPosition", "watermarkScale", "watermarkOpacity",
  "watermarkMargin", "lutAssetId", "audioMode", "voScript", "voVerbatim",
  "voDeliveryNotes", "musicAssetId", "musicVolume", "musicDucking", "musicMuted",
  "voVolume", "voMuted", "llmModel", "videoModel", "ttsModel", "ttsVoice", "imageModel",
  "generateAudio", "concept", "scriptFull",
] as const;

const SEGMENT_FIELDS = [
  "id", "index", "title", "source", "prompt", "videoModel", "speed", "durationS",
  "sourceDurationS", "trimStartS", "imageMotion", "muted", "brightness", "contrast",
  "saturation", "transform", "track", "audioOnly", "library", "offsetS", "pip", "effects",
  "status", "importUrl", "importStartS", "importEndS", "sourceAssetId", "refImageId",
  "refRole", "clipAssetId", "attempts", "error",
] as const;

const TEXT_OVERLAY_FIELDS = [
  "id", "index", "text", "position", "sizePct", "color", "boxEnabled", "boxColor",
  "boxOpacity", "marginPx", "startS", "endS", "animation",
] as const;

const AUDIO_OVERLAY_FIELDS = [
  "id", "index", "label", "assetId", "sourceUrl", "importStartS", "importEndS", "offsetS",
  "volume", "included", "durationS", "status", "error",
] as const;

type Row = Record<string, unknown>;
const pick = (row: Row, keys: readonly string[]): Row =>
  Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k] ?? null]));

export interface CheckpointData {
  version: number;
  capturedAt: string;
  project: Row;
  segments: Row[];
  textOverlays: Row[];
  audioOverlays: Row[];
}

export async function captureCheckpoint(projectId: string): Promise<CheckpointData> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      segments: { orderBy: { index: "asc" } },
      textOverlays: { orderBy: { index: "asc" } },
      audioOverlays: { orderBy: { index: "asc" } },
    },
  });
  if (!p) throw new Error("project not found");
  return {
    version: CHECKPOINT_VERSION,
    capturedAt: new Date().toISOString(),
    project: pick(p as unknown as Row, PROJECT_FIELDS),
    segments: p.segments.map((s) => pick(s as unknown as Row, SEGMENT_FIELDS)),
    textOverlays: p.textOverlays.map((t) => pick(t as unknown as Row, TEXT_OVERLAY_FIELDS)),
    audioOverlays: p.audioOverlays.map((a) => pick(a as unknown as Row, AUDIO_OVERLAY_FIELDS)),
  };
}

export function summarize(data: CheckpointData) {
  return {
    segments: data.segments.length,
    textOverlays: data.textOverlays.length,
    audioOverlays: data.audioOverlays.length,
    title: (data.project.title as string) ?? null,
  };
}

/**
 * Put the captured rows back. Asset references that no longer exist are
 * dropped (a segment whose source media is gone is skipped entirely). Runs in
 * one transaction; the unique (projectId, index) constraint is side-stepped by
 * parking surviving segments at negative indexes first.
 */
export async function restoreCheckpoint(projectId: string, data: CheckpointData): Promise<void> {
  if (data.version !== CHECKPOINT_VERSION) throw new Error(`unsupported checkpoint version ${data.version}`);
  const assets = await prisma.asset.findMany({ where: { projectId }, select: { id: true } });
  const live = new Set(assets.map((a) => a.id));
  const assetOrNull = (v: unknown) => (typeof v === "string" && live.has(v) ? v : null);

  const project: Row = { ...data.project };
  for (const k of ["styleAnchorAssetId", "watermarkAssetId", "lutAssetId", "musicAssetId"]) {
    if (k in project) project[k] = assetOrNull(project[k]);
  }
  const segments = data.segments
    .filter((s) => {
      const src = s.source as string;
      // Uploaded media must still exist; AI shots survive without a clip (re-renderable).
      if ((src === "UPLOAD_VIDEO" || src === "UPLOAD_IMAGE_STILL") && !assetOrNull(s.sourceAssetId)) return false;
      return typeof s.id === "string";
    })
    .map(
      (s): Row => ({
        ...s,
        sourceAssetId: assetOrNull(s.sourceAssetId),
        refImageId: assetOrNull(s.refImageId),
        clipAssetId: assetOrNull(s.clipAssetId),
        // provider job ids are unique across segments; never resurrect one.
        providerJobId: null,
      }),
    )
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((s, i): Row => ({ ...s, index: i }));

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: project as Prisma.ProjectUncheckedUpdateInput });

    const keep = new Set(segments.map((s) => s.id as string));
    const existing = await tx.segment.findMany({ where: { projectId }, select: { id: true } });
    const stale = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (stale.length) await tx.segment.deleteMany({ where: { id: { in: stale } } });
    // Park survivors out of the way of the (projectId, index) unique constraint.
    const survivors = existing.filter((e) => keep.has(e.id));
    for (let i = 0; i < survivors.length; i++) {
      await tx.segment.update({ where: { id: survivors[i].id }, data: { index: -1 - i } });
    }
    const survivorIds = new Set(survivors.map((e) => e.id));
    for (const s of segments) {
      const { id, ...fields } = s;
      if (survivorIds.has(id as string)) {
        await tx.segment.update({ where: { id: id as string }, data: fields as Prisma.SegmentUncheckedUpdateInput });
      } else {
        await tx.segment.create({
          data: { id: id as string, projectId, ...(fields as object) } as Prisma.SegmentUncheckedCreateInput,
        });
      }
    }

    await tx.textOverlay.deleteMany({ where: { projectId } });
    for (const t of data.textOverlays) {
      await tx.textOverlay.create({ data: { ...(t as object), projectId } as Prisma.TextOverlayUncheckedCreateInput });
    }
    await tx.audioOverlay.deleteMany({ where: { projectId } });
    for (const a of data.audioOverlays) {
      await tx.audioOverlay.create({
        data: { ...(a as object), assetId: assetOrNull(a.assetId), projectId } as Prisma.AudioOverlayUncheckedCreateInput,
      });
    }
  });
}
