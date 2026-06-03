import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { patchVariantSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string; elementId: string; variantId: string }> };

async function ownsVariant(projectId: string, elementId: string, variantId: string): Promise<boolean> {
  const v = await prisma.storyElementVariant.findFirst({
    where: { id: variantId, elementId, element: { projectId } },
    select: { id: true },
  });
  return !!v;
}

// Rename / re-describe a variant.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, elementId, variantId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    if (!(await ownsVariant(id, elementId, variantId))) return err("Variant not found", 404);

    const body = await parseJsonBody(request, patchVariantSchema, 8 * 1024);
    const data: Record<string, unknown> = {};
    if (body.label !== undefined) data.label = body.label;
    if (body.prompt !== undefined) data.prompt = body.prompt;
    if (Object.keys(data).length > 0) {
      await prisma.storyElementVariant.update({ where: { id: variantId }, data });
    }
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}

// Delete a variant.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, elementId, variantId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }
    if (!(await ownsVariant(id, elementId, variantId))) return err("Variant not found", 404);

    await prisma.storyElementVariant.delete({ where: { id: variantId } });
    await touchProject(id);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
