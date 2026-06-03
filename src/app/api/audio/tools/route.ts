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
import { duckMusicUnderVoice, trimSilence } from "@/lib/audio/dsp";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("duck"),
    projectId: z.string().min(1),
    musicPath: z.string().min(1),
    voicePath: z.string().min(1),
    reductionDb: z.number().min(3).max(40).optional(),
  }),
  z.object({
    op: z.literal("trim-silence"),
    projectId: z.string().min(1),
    path: z.string().min(1),
    thresholdDb: z.number().min(-90).max(-10).optional(),
    minSilenceS: z.number().min(0.1).max(5).optional(),
  }),
]);

/** Standalone transforms that produce a brand-new track: ducking + silence-trim. */
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, schema);
    await getOwnedProject(body.projectId, user);
    await ensureAudioDir(body.projectId);

    let outName: string;
    let label: string;
    const outAbsOf = (n: string) => path.join(audioProjectDir(body.projectId), n);

    if (body.op === "duck") {
      const musicAbs = resolveAudioFile(body.projectId, body.musicPath);
      const voiceAbs = resolveAudioFile(body.projectId, body.voicePath);
      if (!musicAbs || !voiceAbs) return err("Invalid audio path", 400);
      outName = newAudioFilename("ducked-mix.wav", "wav");
      label = "Ducked mix";
      await duckMusicUnderVoice(musicAbs, voiceAbs, outAbsOf(outName), { reductionDb: body.reductionDb });
    } else {
      const inputAbs = resolveAudioFile(body.projectId, body.path);
      if (!inputAbs) return err("Invalid audio path", 400);
      outName = newAudioFilename("trimmed.wav", "wav");
      label = "Silence-trimmed";
      await trimSilence(inputAbs, outAbsOf(outName), {
        thresholdDb: body.thresholdDb,
        minSilenceS: body.minSilenceS,
      });
    }

    const relPath = audioRelPath(body.projectId, outName);
    const durationS = await probeDuration(outAbsOf(outName));
    return ok({
      relPath,
      name: label,
      durationS,
      url: `/api/audio/file?projectId=${encodeURIComponent(body.projectId)}&p=${encodeURIComponent(relPath)}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
