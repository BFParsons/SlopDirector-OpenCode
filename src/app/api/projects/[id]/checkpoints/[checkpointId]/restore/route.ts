import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { notifyProjectChanged } from "@/lib/projects/changed";
import { type CheckpointData, restoreCheckpoint } from "@/lib/projects/checkpoints";
import { projectSnapshot } from "@/lib/projects/serialize";

type Ctx = { params: Promise<{ id: string; checkpointId: string }> };

/** POST → put the project back to this checkpoint; returns the new snapshot. */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, checkpointId } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") return err("Cannot restore while RENDERING", 409);
    const row = await prisma.projectCheckpoint.findFirst({ where: { id: checkpointId, projectId: id } });
    if (!row) return err("Checkpoint not found", 404);
    await restoreCheckpoint(id, row.data as unknown as CheckpointData);
    notifyProjectChanged(id, request, { reason: "checkpoint.restore", checkpointId });
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
