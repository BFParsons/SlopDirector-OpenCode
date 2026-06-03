import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { createJob, failJob, finishJob } from "@/lib/audio/jobs";
import { importYouTubeMp3, type YtMp3Result } from "@/lib/audio/ytmp3";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().min(1),
  url: z.string().min(1).max(500),
});

/** Kick off a YouTube → mp3 import into the Audio Studio; returns a jobId. */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);

    const job = createJob(body.projectId, "ytmp3");
    void importYouTubeMp3(body.projectId, body.url, job.id)
      .then((r: YtMp3Result) =>
        finishJob(job.id, {
          ...r,
          url: `/api/audio/file?projectId=${encodeURIComponent(body.projectId)}&p=${encodeURIComponent(r.relPath)}`,
        }),
      )
      .catch((e) => failJob(job.id, (e as Error).message));

    return ok({ jobId: job.id });
  } catch (e) {
    return handleApiError(e);
  }
}
