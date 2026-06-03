import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { addVariantSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string; elementId: string }> };

const MAX_VARIANTS = 30;

// Add a variant to an element (a character outfit, a scene at night, etc.).
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, elementId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const element = await prisma.storyElement.findFirst({
      where: { id: elementId, projectId: id },
      select: { id: true },
    });
    if (!element) return err("Element not found", 404);

    const body = await parseJsonBody(request, addVariantSchema, 8 * 1024);
    const count = await prisma.storyElementVariant.count({ where: { elementId } });
    if (count >= MAX_VARIANTS) return err(`At most ${MAX_VARIANTS} variants`, 409);

    await prisma.storyElementVariant.create({
      data: { elementId, label: body.label, prompt: body.prompt ?? "", index: count },
    });
    await touchProject(id);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
