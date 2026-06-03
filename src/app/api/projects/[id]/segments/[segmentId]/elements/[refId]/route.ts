import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { patchShotElementSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string; segmentId: string; refId: string }> };

async function ownsRef(projectId: string, segmentId: string, refId: string): Promise<boolean> {
  const r = await prisma.segmentElementRef.findFirst({
    where: { id: refId, segmentId, segment: { projectId } },
    select: { id: true },
  });
  return !!r;
}

// Change which variant (outfit / camera angle) of the element the shot uses.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, segmentId, refId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    if (!(await ownsRef(id, segmentId, refId))) return err("Reference not found", 404);

    const body = await parseJsonBody(request, patchShotElementSchema, 8 * 1024);
    await prisma.segmentElementRef.update({
      where: { id: refId },
      data: { variantId: body.variantId ?? null },
    });
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}

// Remove an element reference from a shot.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, segmentId, refId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    if (!(await ownsRef(id, segmentId, refId))) return err("Reference not found", 404);

    await prisma.segmentElementRef.delete({ where: { id: refId } });
    await touchProject(id);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
