import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { recentActivity } from "@/lib/agent/activity";

type Ctx = { params: Promise<{ id: string }> };

/** GET ?limit=100 → the recent agent activity for this project (newest last). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    const limit = Math.min(300, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 100) || 100));
    return ok({ activity: recentActivity(id, limit) });
  } catch (e) {
    return handleApiError(e);
  }
}
