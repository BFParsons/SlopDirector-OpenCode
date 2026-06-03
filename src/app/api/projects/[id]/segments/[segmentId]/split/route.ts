import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { splitSegmentSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string; segmentId: string }> };

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Blade — split a clip at a local offset `atS` into two contiguous segments. The
 * second half shares the same source/visual and advances its in-point by the
 * consumed source seconds (`trimStartS += firstDur * speed`), so the cut is
 * seamless. Stills just split duration (no source in-point).
 */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, segmentId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const { atS } = await parseJsonBody(request, splitSegmentSchema, 4 * 1024);
    const seg = await prisma.segment.findFirst({ where: { id: segmentId, projectId: id } });
    if (!seg) return err("Segment not found", 404);

    // Both halves must keep at least 0.1s.
    const firstDur = round1(Math.min(Math.max(0.1, atS), seg.durationS - 0.1));
    const secondDur = round1(seg.durationS - firstDur);
    if (firstDur < 0.1 || secondDur < 0.1) {
      return err("Split point is too close to an edge", 400);
    }

    const speed = seg.speed || 1;
    const isStill = seg.source === "UPLOAD_IMAGE_STILL";
    const secondTrim = isStill ? 0 : round1((seg.trimStartS ?? 0) + firstDur * speed);

    await prisma.$transaction(async (tx) => {
      // Open a slot at index+1 by shifting later segments up. Descending order
      // dodges the [projectId, index] unique constraint mid-update.
      const later = await tx.segment.findMany({
        where: { projectId: id, index: { gt: seg.index } },
        orderBy: { index: "desc" },
        select: { id: true, index: true },
      });
      for (const s of later) {
        await tx.segment.update({ where: { id: s.id }, data: { index: s.index + 1 } });
      }

      await tx.segment.update({ where: { id: seg.id }, data: { durationS: firstDur } });

      await tx.segment.create({
        data: {
          projectId: id,
          index: seg.index + 1,
          title: seg.title,
          source: seg.source,
          prompt: seg.prompt,
          videoModel: seg.videoModel,
          speed: seg.speed,
          durationS: secondDur,
          sourceDurationS: seg.sourceDurationS,
          trimStartS: secondTrim,
          imageMotion: seg.imageMotion,
          muted: seg.muted,
          brightness: seg.brightness,
          contrast: seg.contrast,
          saturation: seg.saturation,
          transform: seg.transform ?? undefined,
          track: seg.track,
          // On the overlay track the second half follows the first; on V1 the
          // offset is unused.
          offsetS: seg.track === 1 ? round1((seg.offsetS ?? 0) + firstDur) : seg.offsetS,
          pip: seg.pip ?? undefined,
          status: seg.status,
          importUrl: seg.importUrl,
          importStartS: seg.importStartS,
          importEndS: seg.importEndS,
          sourceAssetId: seg.sourceAssetId,
          refImageId: seg.refImageId,
          refRole: seg.refRole,
          clipAssetId: seg.clipAssetId,
          // providerJobId is @unique — the clip already exists; don't copy it.
        },
      });
    });

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
