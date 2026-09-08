import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { type CheckpointData, summarize } from "@/lib/projects/checkpoints";

type Ctx = { params: Promise<{ id: string; checkpointId: string }> };

/** GET → the checkpoint incl. its captured data. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, checkpointId } = await params;
    await getOwnedProject(id, user);
    const row = await prisma.projectCheckpoint.findFirst({ where: { id: checkpointId, projectId: id } });
    if (!row) return err("Checkpoint not found", 404);
    const data = row.data as unknown as CheckpointData;
    return ok({ id: row.id, label: row.label, createdAt: row.createdAt, ...summarize(data), data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id, checkpointId } = await params;
    await getOwnedProject(id, user);
    const res = await prisma.projectCheckpoint.deleteMany({ where: { id: checkpointId, projectId: id } });
    if (res.count === 0) return err("Checkpoint not found", 404);
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
