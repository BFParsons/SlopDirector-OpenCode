import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { isAiSegment, setProjectStatus, setSegmentStatus } from "@/lib/jobs/orchestrator";
import { enqueue } from "@/lib/jobs/queue";
import { getOwnedProject } from "@/lib/projects/access";
import { notifyProjectChanged } from "@/lib/projects/changed";

type Ctx = { params: Promise<{ id: string; segmentId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, segmentId } = await params;
    await getOwnedProject(id, user);

    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, projectId: id },
    });
    if (!segment) return err("Segment not found", 404);

    // A failed YouTube import re-runs the download — a pre-render step, so the
    // project status is left untouched.
    if (segment.importUrl) {
      await setSegmentStatus(segmentId, "DOWNLOADING", {
        error: null,
        sourceAssetId: null,
      });
      await enqueue("IMPORT_YOUTUBE", { segmentId }, { projectId: id });
      notifyProjectChanged(id, _req);
      return ok({ ok: true });
    }

    if (!isAiSegment(segment.source)) {
      return err("Only AI or imported segments can be retried", 400);
    }

    // Reset this segment and re-open assembly so it can fire again once ready.
    await setSegmentStatus(segmentId, "PENDING", {
      error: null,
      providerJobId: null,
      clipAssetId: null,
    });
    await prisma.finalRender.updateMany({
      where: { projectId: id, status: { in: ["FAILED", "RUNNING"] } },
      data: { status: "PENDING", error: null, progress: 0 },
    });
    await setProjectStatus(id, "RENDERING");
    await enqueue("SUBMIT_SHOT", { segmentId }, { projectId: id });

    notifyProjectChanged(id, _req);

    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
