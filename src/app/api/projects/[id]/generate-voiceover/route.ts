import { randomUUID } from "node:crypto";
import { requireApiUser } from "@/lib/auth/rbac";
import { absolutePath, saveAsset } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { probeDuration } from "@/lib/ffmpeg/probe";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { keyForProject } from "@/lib/openrouter/userKey";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { resolveTtsModel, synthesizeNarration } from "@/lib/tts/synthesize";
import { generateVoiceoverSchema } from "@/lib/validation/project";
import { notifyProjectChanged } from "@/lib/projects/changed";

type Ctx = { params: Promise<{ id: string }> };

// Simplified voiceover generation: synthesize TTS from text and drop it on an
// audio track as a generic audio clip (an audio-only segment). Synchronous —
// TTS returns the audio bytes directly. The provider and voice come from
// src/lib/tts/synthesize.ts: an explicit ttsModel/voice, else the server's
// configured narrator (ElevenLabs house voice when ELEVENLABS_API_KEY is set).
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, generateVoiceoverSchema, 16 * 1024);
    if (!resolveTtsModel(body.ttsModel)) return err("Unknown voice model", 400);

    const apiKey = await keyForProject(id);
    const instructions = body.instructions?.trim() || undefined;

    const audio = await synthesizeNarration({
      ttsModel: body.ttsModel,
      voice: body.voice,
      text: body.text,
      instructions,
      openRouterKey: apiKey,
    });

    const asset = await saveAsset({
      projectId: id,
      kind: "UPLOAD_AUDIO",
      sub: "uploads",
      filename: `${randomUUID()}.${audio.ext}`,
      data: audio.data,
      mime: audio.mime,
    });
    const durationS = await probeDuration(absolutePath(asset.path));

    const maxIdx = (
      await prisma.segment.aggregate({ where: { projectId: id }, _max: { index: true } })
    )._max.index;
    const index = maxIdx == null ? 0 : maxIdx + 1;

    // A generic audio clip on the audio track (audioOnly segment).
    await prisma.segment.create({
      data: {
        projectId: id,
        index,
        source: "UPLOAD_VIDEO",
        title: body.text.slice(0, 40),
        prompt: "",
        sourceAssetId: asset.id,
        audioOnly: true,
        durationS: durationS > 0 ? durationS : 5,
        offsetS: 0,
        muted: false,
        status: "READY",
        track: 0,
        library: true, // lands in the Media Bucket, not the timeline
      },
    });

    notifyProjectChanged(id, request);

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
