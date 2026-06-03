import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { createJob, failJob, finishJob } from "@/lib/audio/jobs";
import { runMix, type MixResult } from "@/lib/audio/mix";

export const dynamic = "force-dynamic";

const trackSchema = z.object({
  relPath: z.string().min(1),
  volume: z.number().min(0).max(4).default(1),
  muted: z.boolean().default(false),
  solo: z.boolean().default(false),
  offsetS: z.number().min(0).max(36000).default(0),
  trimStartS: z.number().min(0).max(36000).optional(),
  durationS: z.number().min(0).max(36000).optional(),
});

const schema = z.object({
  projectId: z.string().min(1),
  tracks: z.array(trackSchema).min(1),
  format: z.enum(["wav", "mp3"]).optional(),
  name: z.string().max(80).optional(),
  normalize: z.boolean().optional(),
});

/** Kick off an Audio Studio mixdown; returns a jobId to poll. */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);

    const job = createJob(body.projectId, "mix");
    // Fire-and-forget: the client polls /api/audio/jobs/[id] for progress.
    void runMix(
      body.projectId,
      body.tracks,
      { format: body.format, name: body.name, normalize: body.normalize },
      job.id,
    )
      .then((mix: MixResult) => {
        finishJob(job.id, {
          ...mix,
          url: `/api/audio/file?projectId=${encodeURIComponent(body.projectId)}&p=${encodeURIComponent(mix.relPath)}`,
        });
      })
      .catch((e) => failJob(job.id, (e as Error).message));

    return ok({ jobId: job.id });
  } catch (e) {
    return handleApiError(e);
  }
}
