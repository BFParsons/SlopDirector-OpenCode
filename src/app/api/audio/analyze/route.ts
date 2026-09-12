import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { resolveAudioFile } from "@/lib/audio/workspace";
import { prisma } from "@/lib/db/client";
import { absolutePath } from "@/lib/assets/storage";
import { detectSilence, detectTempo, measureLoudness } from "@/lib/audio/analyze";
import { cachedJson } from "@/lib/media/cache";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    projectId: z.string().min(1),
    // Either a workspace file (audio-studio) or a DB Asset id (video timeline).
    path: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    kinds: z.array(z.enum(["loudness", "silence", "tempo"])).min(1),
  })
  .refine((b) => !!b.path || !!b.assetId, { message: "path or assetId is required" });

/** Read-only analysis: LUFS loudness, silence spans, and/or tempo (BPM). */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);

    let abs: string | null = null;
    if (body.assetId) {
      const asset = await prisma.asset.findUnique({ where: { id: body.assetId } });
      if (asset) {
        await getOwnedProject(asset.projectId, user);
        abs = absolutePath(asset.path);
      }
    } else if (body.path) {
      abs = resolveAudioFile(body.projectId, body.path);
    }
    if (!abs) return err("Invalid audio path", 400);

    const c = <T>(key: string, fn: () => Promise<T>) => cachedJson(key, abs, fn);
    const [loudness, silence, tempo] = await Promise.all([
      body.kinds.includes("loudness") ? c("loudness", () => measureLoudness(abs)) : Promise.resolve(null),
      body.kinds.includes("silence") ? c("silence", () => detectSilence(abs)) : Promise.resolve(null),
      // A missing Python dependency must not permanently cache an empty result.
      body.kinds.includes("tempo") ? cachedJson("tempo", abs, () => detectTempo(abs), (result) => result.bpm != null && result.beatsS.length > 0) : Promise.resolve(null),
    ]);

    return ok({ loudness, silence, tempo });
  } catch (e) {
    return handleApiError(e);
  }
}
