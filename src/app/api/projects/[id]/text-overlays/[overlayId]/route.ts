import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { notifyProjectChanged } from "@/lib/projects/changed";

type Ctx = { params: Promise<{ id: string; overlayId: string }> };

// Remove a text overlay. (Per-item style/timing is saved via the project PATCH.)
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, overlayId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const deleted = await prisma.textOverlay.deleteMany({
      where: { id: overlayId, projectId: id },
    });
    if (deleted.count === 0) return err("Text overlay not found", 404);

    await touchProject(id);
    notifyProjectChanged(id, _req);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
