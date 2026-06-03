import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { enqueue } from "@/lib/jobs/queue";
import { getOwnedProject } from "@/lib/projects/access";
import { generateImageSchema } from "@/lib/validation/project";

type Ctx = { params: Promise<{ id: string }> };

// Generate a storyboard keyframe via the image-provider seam (fal.ai/ComfyUI).
// Runs async on the worker; the result is saved as a project image asset and,
// when targetSegmentId is given, attached to that segment as its reference image.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, generateImageSchema, 16 * 1024);
    // Low retry count: a config error (missing key) won't fix on retry, and we
    // want failures to surface on the shot quickly rather than after long backoff.
    await enqueue("GEN_IMAGE", { projectId: id, ...body }, { projectId: id, maxAttempts: 2 });
    return ok({ queued: true });
  } catch (e) {
    return handleApiError(e);
  }
}
