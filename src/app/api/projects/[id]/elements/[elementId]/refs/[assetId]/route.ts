import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { encodeRefIds, parseRefIds } from "@/lib/db/reflist";
import { projectSnapshot } from "@/lib/projects/serialize";

type Ctx = { params: Promise<{ id: string; elementId: string; assetId: string }> };

// Remove a reference image from an element.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, elementId, assetId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const element = await prisma.storyElement.findFirst({
      where: { id: elementId, projectId: id },
      select: { refImageIds: true },
    });
    if (!element) return err("Element not found", 404);

    await prisma.storyElement.update({
      where: { id: elementId },
      data: { refImageIds: encodeRefIds(parseRefIds(element.refImageIds).filter((x) => x !== assetId)) },
    });
    await touchProject(id);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
