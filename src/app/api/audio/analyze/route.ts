import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { resolveAudioFile } from "@/lib/audio/workspace";
import { detectSilence, detectTempo, measureLoudness } from "@/lib/audio/analyze";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().min(1),
  path: z.string().min(1),
  kinds: z.array(z.enum(["loudness", "silence", "tempo"])).min(1),
});

/** Read-only analysis: LUFS loudness, silence spans, and/or tempo (BPM). */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);

    const abs = resolveAudioFile(body.projectId, body.path);
    if (!abs) return err("Invalid audio path", 400);

    const [loudness, silence, tempo] = await Promise.all([
      body.kinds.includes("loudness") ? measureLoudness(abs) : Promise.resolve(null),
      body.kinds.includes("silence") ? detectSilence(abs) : Promise.resolve(null),
      body.kinds.includes("tempo") ? detectTempo(abs) : Promise.resolve(null),
    ]);

    return ok({ loudness, silence, tempo });
  } catch (e) {
    return handleApiError(e);
  }
}
