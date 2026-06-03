import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { addShotElementSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string; segmentId: string }> };

const MAX_REFS = 12;

// Reference a library element (scene / character / object) in a shot, so the
// shot's keyframe is generated from it (optionally a specific variant).
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
      select: { id: true },
    });
    if (!segment) return err("Shot not found", 404);

    const body = await parseJsonBody(request, addShotElementSchema, 8 * 1024);
    const element = await prisma.storyElement.findFirst({
      where: { id: body.elementId, projectId: id },
      select: { id: true },
    });
    if (!element) return err("Element not found", 404);

    const count = await prisma.segmentElementRef.count({ where: { segmentId } });
    if (count >= MAX_REFS) return err(`At most ${MAX_REFS} elements per shot`, 409);

    await prisma.segmentElementRef.create({
      data: { segmentId, elementId: body.elementId, variantId: body.variantId ?? null, index: count },
    });
    await touchProject(id);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
