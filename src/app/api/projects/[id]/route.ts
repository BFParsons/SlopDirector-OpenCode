import { requireApiUser, AuthError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { writeProjectManifest } from "@/lib/projects/bundle";
import { patchProjectSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE_STATUSES = new Set(["DRAFT", "DONE", "FAILED"]);

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    const snapshot = await projectSnapshot(id);
    if (!snapshot) throw new AuthError("Project not found", 404);
    return ok(snapshot);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);

    if (!EDITABLE_STATUSES.has(project.status)) {
      return err(
        `Cannot edit a project while it is ${project.status}`,
        409,
      );
    }

    const body = await parseJsonBody(request, patchProjectSchema, 256 * 1024);

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          title: body.title,
          frameWidth: body.frameWidth,
          frameHeight: body.frameHeight,
          exportCodec: body.exportCodec,
          captionsEnabled: body.captionsEnabled,
          captionPosition: body.captionPosition,
          captionSizePct: body.captionSizePct,
          captionStyle: body.captionStyle,
          goal: body.goal,
          subject: body.subject,
          tone: body.tone,
          concept: body.concept,
          stylePrompt: body.stylePrompt,
          styleAnchorAssetId: body.styleAnchorAssetId,
          styleStrength: body.styleStrength,
          audioMode: body.audioMode,
          scriptFull: body.scriptFull,
          voScript: body.voScript,
          voVerbatim: body.voVerbatim,
          voDeliveryNotes: body.voDeliveryNotes,
          musicVolume: body.musicVolume,
          musicDucking: body.musicDucking,
          audioNormalize: body.audioNormalize,
          colorLook: body.colorLook,
          transition: body.transition,
          transitionMs: body.transitionMs,
          fillMode: body.fillMode,
          vignette: body.vignette,
          grain: body.grain,
          audioFadeInS: body.audioFadeInS,
          audioFadeOutS: body.audioFadeOutS,
          watermarkPosition: body.watermarkPosition,
          watermarkScale: body.watermarkScale,
          watermarkOpacity: body.watermarkOpacity,
          watermarkMargin: body.watermarkMargin,
          videoModel: body.videoModel,
          ttsModel: body.ttsModel,
          imageModel: body.imageModel,
          ttsVoice: body.ttsVoice,
          audioFitMode: body.audioFitMode,
        },
      });

      if (body.segments) {
        const existing = await tx.segment.findMany({
          where: { projectId: id },
          select: { id: true, source: true },
        });
        const sourceById = new Map(existing.map((e) => [e.id, e.source]));
        // Valid upload-image ids owned by this project, for refImage validation.
        const validImageIds = new Set(
          (
            await tx.asset.findMany({
              where: { projectId: id, kind: "UPLOAD_IMAGE" },
              select: { id: true },
            })
          ).map((a) => a.id),
        );

        for (const s of body.segments) {
          const source = sourceById.get(s.id);
          if (!source) continue;
          const data: Record<string, unknown> = {};
          if (s.prompt !== undefined) data.prompt = s.prompt;
          if (s.videoModel !== undefined) data.videoModel = s.videoModel;
          if (s.speed !== undefined) data.speed = s.speed;
          if (s.durationS !== undefined) data.durationS = s.durationS;
          if (s.trimStartS !== undefined) data.trimStartS = s.trimStartS;
          if (s.imageMotion !== undefined) data.imageMotion = s.imageMotion;
          if (s.muted !== undefined) data.muted = s.muted;
          if (s.brightness !== undefined) data.brightness = s.brightness;
          if (s.contrast !== undefined) data.contrast = s.contrast;
          if (s.saturation !== undefined) data.saturation = s.saturation;
          if (s.track !== undefined) data.track = s.track;
          if (s.offsetS !== undefined) data.offsetS = s.offsetS;
          if (s.audioOnly !== undefined) data.audioOnly = s.audioOnly;
          if (s.pip !== undefined) data.pip = s.pip ?? null;
          if (s.transform !== undefined) data.transform = s.transform ?? null;
          if (s.effects !== undefined) data.effects = s.effects ?? null;

          if (source === "AI_GENERATED") {
            // Optional reference image; refRole only meaningful with an image.
            const refImageId =
              s.refImageId && validImageIds.has(s.refImageId) ? s.refImageId : null;
            data.refImageId = refImageId;
            data.refRole = refImageId ? (s.refRole ?? "FIRST_FRAME") : null;
          } else if (source === "UPLOAD_IMAGE_DRIVER") {
            // The driver image lives in sourceAsset; refRole steers how it's used.
            if (s.refRole) data.refRole = s.refRole;
          }
          await tx.segment.updateMany({ where: { id: s.id, projectId: id }, data });
        }
      }

      if (body.audioOverlays) {
        for (const o of body.audioOverlays) {
          const data: Record<string, unknown> = {};
          if (o.volume !== undefined) data.volume = o.volume;
          if (o.offsetS !== undefined) data.offsetS = o.offsetS;
          if (o.included !== undefined) data.included = o.included;
          if (o.label !== undefined) data.label = o.label;
          if (Object.keys(data).length === 0) continue;
          await tx.audioOverlay.updateMany({ where: { id: o.id, projectId: id }, data });
        }
      }

      if (body.textOverlays) {
        for (const t of body.textOverlays) {
          const data: Record<string, unknown> = {};
          if (t.text !== undefined) data.text = t.text;
          if (t.position !== undefined) data.position = t.position;
          if (t.sizePct !== undefined) data.sizePct = t.sizePct;
          if (t.color !== undefined) data.color = t.color;
          if (t.boxEnabled !== undefined) data.boxEnabled = t.boxEnabled;
          if (t.boxColor !== undefined) data.boxColor = t.boxColor;
          if (t.boxOpacity !== undefined) data.boxOpacity = t.boxOpacity;
          if (t.marginPx !== undefined) data.marginPx = t.marginPx;
          if (t.startS !== undefined) data.startS = t.startS;
          if (t.endS !== undefined) data.endS = t.endS;
          if (t.animation !== undefined) data.animation = t.animation;
          if (Object.keys(data).length === 0) continue;
          await tx.textOverlay.updateMany({ where: { id: t.id, projectId: id }, data });
        }
      }
    });

    const snapshot = await projectSnapshot(id);
    // Keep the portable project.json in sync with this save (no-op if legacy).
    await writeProjectManifest(id).catch(() => {});
    return ok(snapshot);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
