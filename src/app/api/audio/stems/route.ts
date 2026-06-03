import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { resolveAudioFile } from "@/lib/audio/workspace";
import { createJob, failJob, finishJob } from "@/lib/audio/jobs";
import { runDemucs, type DemucsStem } from "@/lib/audio/demucs";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().min(1),
  path: z.string().min(1),
  model: z.string().max(40).optional(),
  twoStems: z.string().max(20).nullable().optional(),
});

/** Kick off a Demucs stem-separation job; returns a jobId to poll. */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);

    const abs = resolveAudioFile(body.projectId, body.path);
    if (!abs) return err("Invalid audio path", 400);

    const job = createJob(body.projectId, "stems");
    // Fire-and-forget: the client polls /api/audio/jobs/[id] for progress.
    void runDemucs(body.projectId, abs, { model: body.model, twoStems: body.twoStems ?? null }, job.id)
      .then((stems: DemucsStem[]) => {
        finishJob(
          job.id,
          stems.map((s) => ({
            ...s,
            url: `/api/audio/file?projectId=${encodeURIComponent(body.projectId)}&p=${encodeURIComponent(s.relPath)}`,
          })),
        );
      })
      .catch((e) => failJob(job.id, (e as Error).message));

    return ok({ jobId: job.id });
  } catch (e) {
    return handleApiError(e);
  }
}
