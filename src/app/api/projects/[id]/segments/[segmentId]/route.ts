import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";

type Ctx = { params: Promise<{ id: string; segmentId: string }> };

// Remove a segment and compact the remaining indices to 0..n-1.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, segmentId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const deleted = await prisma.segment.deleteMany({
      where: { id: segmentId, projectId: id },
    });
    if (deleted.count === 0) return err("Segment not found", 404);

    const rest = await prisma.segment.findMany({
      where: { projectId: id },
      orderBy: { index: "asc" },
    });
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].index !== i) {
        await prisma.segment.update({ where: { id: rest[i].id }, data: { index: i } });
      }
    }

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
