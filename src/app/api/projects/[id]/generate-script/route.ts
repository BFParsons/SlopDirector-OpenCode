import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { setScriptGenStatus } from "@/lib/jobs/orchestrator";
import { enqueue } from "@/lib/jobs/queue";
import { getOwnedProject } from "@/lib/projects/access";
import { notifyProjectChanged } from "@/lib/projects/changed";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["DRAFT", "DONE", "FAILED"]);

// Audio track: (re)write the full script + voiceover narration from the brief.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (!ALLOWED.has(project.status)) {
      return err(`Cannot generate while ${project.status}`, 409);
    }
    await setScriptGenStatus(id, "RUNNING");
    await enqueue("GEN_SCRIPT", { projectId: id }, { projectId: id });
    notifyProjectChanged(id, _req);
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
