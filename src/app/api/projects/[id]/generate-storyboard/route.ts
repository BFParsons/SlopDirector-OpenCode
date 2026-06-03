import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { setVisualGenStatus } from "@/lib/jobs/orchestrator";
import { enqueue } from "@/lib/jobs/queue";
import { getOwnedProject } from "@/lib/projects/access";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["DRAFT", "DONE", "FAILED"]);

// Visual track: (re)generate concept + AI segments from the brief.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (!ALLOWED.has(project.status)) {
      return err(`Cannot generate while ${project.status}`, 409);
    }
    await setVisualGenStatus(id, "RUNNING");
    await enqueue("GEN_STORYBOARD", { projectId: id }, { projectId: id });
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
