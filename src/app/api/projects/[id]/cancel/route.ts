import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { setProjectStatus } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";

type Ctx = { params: Promise<{ id: string }> };

// Abort an in-progress render and return the project to DRAFT so it can be
// edited. Already-rendered segments keep their clips (a later re-render reuses
// them). In-flight provider jobs may still finish; their reconcile/download
// won't auto-assemble because maybeEnqueueAssembly only fires while RENDERING.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status !== "RENDERING") {
      return err(`Nothing to cancel (project is ${project.status})`, 409);
    }
    await prisma.finalRender.updateMany({
      where: { projectId: id },
      data: { status: "PENDING", progress: 0, error: null, assetId: null },
    });
    await setProjectStatus(id, "DRAFT");
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
