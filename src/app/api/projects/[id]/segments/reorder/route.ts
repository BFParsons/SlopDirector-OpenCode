import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { reorderSegmentsSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, reorderSegmentsSchema, 8 * 1024);
    const segs = await prisma.segment.findMany({
      where: { projectId: id },
      select: { id: true },
    });
    const ids = new Set(segs.map((s) => s.id));
    if (
      body.orderedIds.length !== segs.length ||
      !body.orderedIds.every((x) => ids.has(x))
    ) {
      return err("orderedIds must list exactly the project's segments", 400);
    }

    // Two-pass to avoid hitting the unique [projectId, index] constraint.
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < body.orderedIds.length; i++) {
        await tx.segment.update({
          where: { id: body.orderedIds[i] },
          data: { index: 1000 + i },
        });
      }
      for (let i = 0; i < body.orderedIds.length; i++) {
        await tx.segment.update({
          where: { id: body.orderedIds[i] },
          data: { index: i },
        });
      }
    });

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
