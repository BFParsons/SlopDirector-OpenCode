import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { resolveAudioFile } from "@/lib/audio/workspace";
import { createJob, failJob, finishJob } from "@/lib/audio/jobs";
import { runWhisper } from "@/lib/audio/whisper";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().min(1),
  path: z.string().min(1),
  model: z.enum(["tiny", "base", "small", "medium", "large-v3"]).optional(),
  language: z.string().max(10).nullable().optional(),
});

/** Kick off a Whisper transcription job; returns a jobId to poll. */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);

    const abs = resolveAudioFile(body.projectId, body.path);
    if (!abs) return err("Invalid audio path", 400);

    const job = createJob(body.projectId, "transcribe");
    void runWhisper(body.projectId, abs, { model: body.model, language: body.language ?? null }, job.id)
      .then((result) => finishJob(job.id, result))
      .catch((e) => failJob(job.id, (e as Error).message));

    return ok({ jobId: job.id });
  } catch (e) {
    return handleApiError(e);
  }
}
