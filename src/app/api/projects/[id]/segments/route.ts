import type { AssetKind, RefRole } from "@/lib/db/enums";
import { requireApiUser } from "@/lib/auth/rbac";
import { absolutePath, copyAssetToProject } from "@/lib/assets/storage";
import { fingerprint } from "@/lib/media/cache";
import type { Asset } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { addSegmentSchema } from "@/lib/validation/project";
import { notifyProjectChanged } from "@/lib/projects/changed";

type Ctx = { params: Promise<{ id: string }> };

// Add one visual segment (AI, uploaded video, uploaded photo still, or driver).
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, addSegmentSchema, 8 * 1024);

    const maxIdx = (
      await prisma.segment.aggregate({
        where: { projectId: id },
        _max: { index: true },
      })
    )._max.index;
    const index = maxIdx == null ? 0 : maxIdx + 1;

    let status: "PENDING" | "READY" = "PENDING";
    let durationS = body.durationS ?? 5;
    let sourceDurationS: number | null = null;
    let sourceAssetId: string | null = null;
    let refImageId: string | null = null;
    let refRole: RefRole | null = body.refRole ?? null;

    if (body.source === "AI_GENERATED") {
      if (body.refImageId) {
        const img = await prisma.asset.findFirst({
          where: { id: body.refImageId, projectId: id, kind: "UPLOAD_IMAGE" },
        });
        if (img) {
          refImageId = img.id;
          refRole = body.refRole ?? "FIRST_FRAME";
        }
      }
    } else {
      if (!body.sourceAssetId) {
        return err("sourceAssetId is required for an uploaded segment", 400);
      }
      // A video segment may reuse an uploaded video OR a previously generated
      // clip (SHOT_CLIP); image segments source an uploaded photo. An audio-only
      // clip may also source an uploaded audio file.
      const wantKinds: AssetKind[] = body.audioOnly
        ? ["UPLOAD_AUDIO", "UPLOAD_VIDEO", "SHOT_CLIP"]
        : body.source === "UPLOAD_VIDEO"
          ? ["UPLOAD_VIDEO", "SHOT_CLIP"]
          : ["UPLOAD_IMAGE"];
      // Accept any asset the user owns (across their projects), not just this
      // one — enables cross-project reuse.
      const asset = await prisma.asset.findFirst({
        where: {
          id: body.sourceAssetId,
          kind: { in: wantKinds },
          project: { userId: user.id },
        },
      });
      if (!asset) return err("source asset not found for this segment type", 400);
      // Reusing from another project: copy the file in so this project owns it
      // (a deleted source project can't then break this segment) — once per
      // source, not once per sub-clip cut from it.
      const effective =
        asset.projectId === id ? asset : await reuseOrCopy(asset, id);
      sourceAssetId = effective.id;

      if (body.source === "UPLOAD_VIDEO") {
        status = "READY";
        const probed = await probeDuration(absolutePath(effective.path));
        if (probed > 0) {
          sourceDurationS = probed;
          const inS = Math.min(probed, Math.max(0, body.trimStartS ?? 0));
          const remaining = Math.round((probed - inS) * 10) / 10;
          // Source Monitor subclip: use the requested duration (capped to what's
          // left after the in-point); otherwise the full remaining length.
          durationS = body.durationS != null ? Math.min(body.durationS, remaining) : remaining;
        }
      } else if (body.source === "UPLOAD_IMAGE_STILL") {
        status = "READY";
      } else {
        // UPLOAD_IMAGE_DRIVER — an AI path; the photo drives generation.
        status = "PENDING";
        refRole = body.refRole ?? "FIRST_FRAME";
      }
    }

    await prisma.segment.create({
      data: {
        projectId: id,
        index,
        source: body.source,
        prompt: body.prompt ?? "",
        durationS,
        sourceDurationS,
        // New stills get a little life by default; other sources have no motion.
        imageMotion:
          body.imageMotion ??
          (body.source === "UPLOAD_IMAGE_STILL" ? "SUBTLE_ZOOM_IN" : "NONE"),
        status,
        sourceAssetId,
        refImageId,
        refRole,
        trimStartS: body.trimStartS ?? 0,
        track: body.track ?? 0,
        offsetS: body.offsetS ?? 0,
        pip: body.pip ?? undefined,
        audioOnly: body.audioOnly ?? false,
        // Uploaded / reused video clips bring their own audio by default (a real
        // NLE clip carries its sound); AI clips and stills stay silent (no audio
        // stream anyway, and the voiceover is the narration track).
        muted: body.muted ?? body.source !== "UPLOAD_VIDEO",
      },
    });

    notifyProjectChanged(id, request);

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * A foreign asset placed on this timeline several times (every sub-clip cut
 * from a source is its own segment) is copied in once: reuse an existing copy
 * with the same content. Same size + same sha256 when both are recorded,
 * otherwise the content fingerprint decides.
 */
async function reuseOrCopy(asset: Asset, projectId: string): Promise<Asset> {
  const candidates = await prisma.asset.findMany({
    where: { projectId, kind: asset.kind, sizeBytes: asset.sizeBytes },
    orderBy: { createdAt: "asc" },
  });
  for (const c of candidates) {
    if (asset.sha256 && c.sha256) {
      if (asset.sha256 === c.sha256) return c;
      continue;
    }
    try {
      if ((await fingerprint(absolutePath(c.path))) === (await fingerprint(absolutePath(asset.path)))) return c;
    } catch {
      /* a copy whose file is gone: skip it */
    }
  }
  return copyAssetToProject(asset, projectId);
}
