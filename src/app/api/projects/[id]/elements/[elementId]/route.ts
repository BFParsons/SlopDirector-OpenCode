import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { patchElementSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string; elementId: string }> };

// Rename / re-describe a story element.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, elementId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, patchElementSchema, 8 * 1024);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.prompt !== undefined) data.prompt = body.prompt;
    if (Object.keys(data).length > 0) {
      await prisma.storyElement.updateMany({ where: { id: elementId, projectId: id }, data });
    }
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}

// Delete a story element (its variants cascade).
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, elementId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    const deleted = await prisma.storyElement.deleteMany({
      where: { id: elementId, projectId: id },
    });
    if (deleted.count === 0) return err("Element not found", 404);
    await touchProject(id);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
