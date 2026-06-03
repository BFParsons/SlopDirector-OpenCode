import path from "node:path";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { probeDuration } from "@/lib/ffmpeg/probe";
import {
  audioProjectDir,
  audioRelPath,
  ensureAudioDir,
  newAudioFilename,
  resolveAudioFile,
} from "@/lib/audio/workspace";
import { applyChain, type AudioEffect } from "@/lib/audio/dsp";

export const dynamic = "force-dynamic";

const effectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noise"), strength: z.number() }),
  z.object({ type: z.literal("loudness"), targetLufs: z.number(), truePeak: z.number().optional() }),
  z.object({ type: z.literal("eq"), bassDb: z.number(), midDb: z.number(), trebleDb: z.number() }),
  z.object({ type: z.literal("deesser"), intensity: z.number() }),
  z.object({ type: z.literal("compressor"), thresholdDb: z.number(), ratio: z.number() }),
  z.object({ type: z.literal("gain"), db: z.number() }),
  z.object({ type: z.literal("fade"), inS: z.number(), outS: z.number(), durationS: z.number() }),
  z.object({ type: z.literal("rolloff"), highpassHz: z.number(), lowpassHz: z.number() }),
]);

const schema = z.object({
  projectId: z.string().min(1),
  path: z.string().min(1),
  effects: z.array(effectSchema).min(1),
  /** Display name for the resulting track. */
  label: z.string().max(80).optional(),
});

/** Apply the processing-rack chain, writing a new track and returning it. */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema, 16 * 1024);
    await getOwnedProject(body.projectId, user);

    const inputAbs = resolveAudioFile(body.projectId, body.path);
    if (!inputAbs) return err("Invalid audio path", 400);

    await ensureAudioDir(body.projectId);
    const outName = newAudioFilename("processed.wav", "wav");
    const outAbs = path.join(audioProjectDir(body.projectId), outName);

    await applyChain(inputAbs, outAbs, body.effects as AudioEffect[]);

    const relPath = audioRelPath(body.projectId, outName);
    const durationS = await probeDuration(outAbs);
    return ok({
      relPath,
      name: body.label || "Processed",
      durationS,
      url: `/api/audio/file?projectId=${encodeURIComponent(body.projectId)}&p=${encodeURIComponent(relPath)}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
