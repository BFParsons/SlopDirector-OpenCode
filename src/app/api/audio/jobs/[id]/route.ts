import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getJob } from "@/lib/audio/jobs";

export const dynamic = "force-dynamic";

/** Poll an Audio Studio job (stem separation / transcription). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const job = getJob(id);
    if (!job) return err("Job not found", 404);
    // Job is bound to a project the caller must own.
    await getOwnedProject(job.projectId, user);

    return ok({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      message: job.message,
      result: job.result,
      error: job.error,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
