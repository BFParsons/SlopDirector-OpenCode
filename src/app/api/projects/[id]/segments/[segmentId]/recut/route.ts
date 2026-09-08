import { env } from "@/env";
import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { enqueue } from "@/lib/jobs/queue";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { recutClipSchema } from "@/lib/validation/project";
import { notifyProjectChanged } from "@/lib/projects/changed";

type Ctx = { params: Promise<{ id: string; segmentId: string }> };

// Re-cut an imported YouTube clip to a new [start,end] without leaving the
// timeline: updates the times and re-downloads just that section.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, segmentId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, projectId: id },
    });
    if (!segment) return err("Segment not found", 404);
    if (!segment.importUrl) return err("Only imported clips can be re-cut", 400);

    const body = await parseJsonBody(request, recutClipSchema, 8 * 1024);
    const startS = Math.floor(body.startS);
    const endS = Math.floor(body.endS);
    if (endS <= startS) return err("Clip end must be after the start", 400);
    const len = endS - startS;
    if (len > env.YT_IMPORT_MAX_SECONDS) {
      return err(`Clip too long (max ${env.YT_IMPORT_MAX_SECONDS}s)`, 400);
    }

    const prevAssetId = segment.sourceAssetId;
    await prisma.segment.update({
      where: { id: segmentId },
      data: {
        importStartS: startS,
        importEndS: endS,
        durationS: len,
        status: "DOWNLOADING",
        sourceAssetId: null,
        error: null,
      },
    });
    // Drop the superseded clip's asset row (the file is overwritten by the new
    // import) so it doesn't linger as a duplicate in the reuse gallery.
    if (prevAssetId) {
      await prisma.asset.delete({ where: { id: prevAssetId } }).catch(() => {});
    }
    await enqueue("IMPORT_YOUTUBE", { segmentId }, { projectId: id });
    await touchProject(id); // resync the editor to show the re-cut in progress

    notifyProjectChanged(id, request);

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
