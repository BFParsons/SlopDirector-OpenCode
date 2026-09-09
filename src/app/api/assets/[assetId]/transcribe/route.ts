import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedAsset } from "@/lib/assets/access";
import { absolutePath } from "@/lib/assets/storage";
import { createJob, failJob, finishJob } from "@/lib/audio/jobs";
import { runWhisper, type TranscribeResult } from "@/lib/audio/whisper";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { extractWav } from "@/lib/media/inspect";
import { mediaCachePath } from "@/lib/media/cache";

type Ctx = { params: Promise<{ assetId: string }> };
const AUDIBLE = new Set(["UPLOAD_VIDEO", "SHOT_CLIP", "FINAL_MP4", "DRAFT_MP4", "UPLOAD_AUDIO", "OVERLAY_AUDIO", "VO_AUDIO"]);

const schema = z.object({
  model: z.enum(["tiny", "base", "small", "medium", "large-v3"]).optional(),
  language: z.string().max(10).nullable().optional(),
  /** true (default): block until the transcript is ready; false: return a jobId to poll at /api/audio/jobs/:id */
  wait: z.boolean().optional(),
  /** ignore a cached transcript */
  force: z.boolean().optional(),
});

/** Transcripts are cached by the file's content (lib/media/cache.ts), so a
 *  clip copied into another project keeps its transcript. */
async function cachePath(abs: string, model: string) {
  return mediaCachePath(abs, `transcript-${model}.json`);
}

/** GET → the cached transcript for this asset (404 until POST has produced one). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;
    const asset = await getOwnedAsset(assetId, user);
    const model = new URL(req.url).searchParams.get("model") ?? "base";
    const file = await cachePath(absolutePath(asset.path), model);
    if (!existsSync(file)) return err("No transcript yet — POST to create one", 404);
    return ok({ assetId: asset.id, model, cached: true, ...(JSON.parse(await readFile(file, "utf8")) as TranscribeResult) });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST { model?, language?, wait?, force? } → Whisper transcript with segment
 * AND word timings (the word list is what a cut-by-transcript edit needs).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { assetId } = await params;
    const asset = await getOwnedAsset(assetId, user);
    if (!AUDIBLE.has(asset.kind)) return err("Asset has no audio", 400);
    const raw = await req.text();
    const body = raw.trim() ? await parseJsonBody(new Request(req.url, { method: "POST", headers: req.headers, body: raw }), schema) : {};
    const model = body.model ?? "base";
    const file = await cachePath(absolutePath(asset.path), model);
    if (!body.force && existsSync(file)) {
      return ok({ assetId: asset.id, model, cached: true, ...(JSON.parse(await readFile(file, "utf8")) as TranscribeResult) });
    }
    const wav = await extractWav(absolutePath(asset.path));
    const job = createJob(asset.project.id, "transcribe");
    const work = runWhisper(asset.project.id, wav, { model, language: body.language ?? null }, job.id)
      .then(async (result) => {
        await writeFile(file, JSON.stringify(result));
        finishJob(job.id, result);
        return result;
      })
      .catch((e: Error) => {
        failJob(job.id, e.message);
        throw e;
      });
    if (body.wait === false) {
      void work.catch(() => {});
      return ok({ assetId: asset.id, model, jobId: job.id });
    }
    const result = await work;
    return ok({ assetId: asset.id, model, cached: false, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
