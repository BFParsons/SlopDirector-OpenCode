import { requireApiUser } from "@/lib/auth/rbac";
import { getVideoModel, videoDurations } from "@/config/models";
import { copyAssetToProject } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { enqueue } from "@/lib/jobs/queue";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { generateClipSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string }> };

// Simplified one-shot video generation: create an AI_GENERATED segment from a
// model + prompt + length (+ optional reference image) and submit it to the
// provider. The generated SHOT_CLIP lands on the V1 timeline.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, generateClipSchema, 8 * 1024);

    const model = getVideoModel(body.videoModel);
    if (!model) return err("Unknown video model", 400);
    if (model.adminOnly && user.role !== "ADMIN") {
      return err(`The model "${model.label}" is restricted to admins (cost control)`, 403);
    }
    const allowed = videoDurations(model.id);
    if (!allowed.includes(body.durationS)) {
      return err(`"${model.label}" only generates ${allowed.join(", ")}s clips`, 400);
    }

    // Optional reference image (a UPLOAD_IMAGE the user owns); copy it into this
    // project if it came from another one so the segment owns its source.
    let refImageId: string | null = null;
    if (body.refAssetId) {
      const asset = await prisma.asset.findFirst({
        where: { id: body.refAssetId, kind: "UPLOAD_IMAGE", project: { userId: user.id } },
      });
      if (!asset) return err("Reference image not found", 400);
      const effective = asset.projectId === id ? asset : await copyAssetToProject(asset, id);
      refImageId = effective.id;
    }

    const maxIdx = (
      await prisma.segment.aggregate({ where: { projectId: id }, _max: { index: true } })
    )._max.index;
    const index = maxIdx == null ? 0 : maxIdx + 1;

    const segment = await prisma.segment.create({
      data: {
        projectId: id,
        index,
        source: "AI_GENERATED",
        prompt: body.prompt,
        videoModel: model.id,
        durationS: body.durationS,
        refImageId,
        refRole: refImageId ? "FIRST_FRAME" : null,
        status: "PENDING",
        track: 0,
        library: true, // lands in the Media Bucket, not the timeline
      },
    });

    await enqueue("SUBMIT_SHOT", { segmentId: segment.id }, { projectId: id });

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
