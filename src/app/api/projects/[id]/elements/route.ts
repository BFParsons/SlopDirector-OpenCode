import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { addElementSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string }> };

const MAX_PER_KIND = 60;

// Create a persistent story element (scene / character / object).
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, addElementSchema, 8 * 1024);
    const count = await prisma.storyElement.count({
      where: { projectId: id, kind: body.kind },
    });
    if (count >= MAX_PER_KIND) {
      return err(`At most ${MAX_PER_KIND} ${body.kind.toLowerCase()}s`, 409);
    }

    await prisma.storyElement.create({
      data: {
        projectId: id,
        kind: body.kind,
        name: body.name,
        prompt: body.prompt ?? "",
        index: count,
      },
    });
    await touchProject(id);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
