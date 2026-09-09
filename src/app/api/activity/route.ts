import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { activitySchema, recordActivity } from "@/lib/agent/activity";

/**
 * POST → an agent reports a tool call (start / end) for the editor's agent
 * lane. The project comes from `projectId`, or from `assetId` when the tool
 * only knows an asset. Events for neither are accepted and dropped.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(req, activitySchema, 16 * 1024);
    let projectId = body.projectId ?? null;
    if (!projectId && body.assetId) {
      const a = await prisma.asset.findUnique({ where: { id: body.assetId }, select: { projectId: true } });
      projectId = a?.projectId ?? null;
    }
    if (!projectId) return ok({ recorded: false });
    try {
      await getOwnedProject(projectId, user);
    } catch {
      return err("project not found", 404);
    }
    recordActivity(projectId, body);
    return ok({ recorded: true });
  } catch (e) {
    return handleApiError(e);
  }
}
