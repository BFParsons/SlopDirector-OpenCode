import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, type Snapshot, assetInfo, snapshot, summarize } from "../client";
import { guarded, text } from "../format";

export function registerMediaTools(server: McpServer) {
  server.registerTool(
    "import_media",
    {
      title: "Import a media file",
      description:
        "Upload a local video, image or audio file into the project's media bucket and return its asset (id, kind, duration, size). " +
        "Does NOT place it on the timeline — call add_segment with the asset id. Video: mp4/mov/mkv/webm/avi/ts…; images: png/jpg/webp; audio: wav/mp3/m4a/flac/ogg.",
      inputSchema: { projectId: z.string(), path: z.string().describe("absolute path on the machine running SlopStudio") },
    },
    guarded(async ({ projectId, path }) => {
      const up = await api.upload<{ id: string }>("/api/uploads", path, { projectId });
      return text(await assetInfo(up.id));
    }),
  );

  server.registerTool(
    "import_youtube",
    {
      title: "Import from YouTube",
      description: "Download a section of a YouTube video (startS–endS) as a video segment on the timeline, or as an audio overlay (kind=audio). Runs as a background job: poll get_project until the segment's status is READY.",
      inputSchema: {
        projectId: z.string(),
        url: z.string().url(),
        startS: z.number().min(0),
        endS: z.number().min(0),
        kind: z.enum(["video", "audio"]).default("video"),
      },
    },
    guarded(async ({ projectId, url, startS, endS, kind }) =>
      text(summarize(await api.post<Snapshot>(`/api/projects/${projectId}/youtube`, { url, startS, endS, kind }))),
    ),
  );

  server.registerTool(
    "list_media",
    {
      title: "List media",
      description: "Reusable media across the user's projects (uploads and generated clips), newest first, with a flag for assets already on this project's timeline.",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId }) => text(await api.get(`/api/projects/${projectId}/clips`))),
  );

  server.registerTool(
    "probe_asset",
    {
      title: "Probe an asset",
      description: "Duration, video stream (codec, size, pixel format), file size, mime and the absolute file path of any asset — including finished renders (finalRender.assetId / draftAssetId).",
      inputSchema: { assetId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ assetId }) => text(await assetInfo(assetId))),
  );

  server.registerTool(
    "set_music",
    {
      title: "Set the music bed",
      description: "Upload a music file as the project's background bed (looped to the video length, ducked under voiceover by default). Volume 0–1.",
      inputSchema: { projectId: z.string(), path: z.string(), volume: z.number().min(0).max(1).optional(), ducking: z.boolean().optional() },
    },
    guarded(async ({ projectId, path, volume, ducking }) => {
      await api.upload(`/api/projects/${projectId}/music`, path);
      const patch: Record<string, unknown> = {};
      if (volume != null) patch.musicVolume = volume;
      if (ducking != null) patch.musicDucking = ducking;
      const snap = Object.keys(patch).length
        ? await api.patch<Snapshot>(`/api/projects/${projectId}`, patch)
        : await api.get<Snapshot>(`/api/projects/${projectId}`);
      return text(summarize(snap));
    }),
  );

  server.registerTool(
    "set_lut",
    {
      title: "Set a colour LUT",
      description: "Upload a .cube 3D LUT applied to every clip after the built-in colour look. Pass remove=true to clear it.",
      inputSchema: { projectId: z.string(), path: z.string().optional(), remove: z.boolean().optional() },
    },
    guarded(async ({ projectId, path, remove }) => {
      if (remove) await api.del(`/api/projects/${projectId}/lut`);
      else if (path) await api.upload(`/api/projects/${projectId}/lut`, path);
      else throw new Error("give a .cube path or remove=true");
      return text(summarize(await api.get<Snapshot>(`/api/projects/${projectId}`)));
    }),
  );

  server.registerTool(
    "generate_narration",
    {
      title: "Generate a narration line (TTS)",
      description:
        "Synthesize one narrator line with the server's default narrator and place it on the timeline as an audio-only clip at offsetS (audible, ducks the music, levelled with volume). Leave voice and ttsModel unset to get the house voice: on a machine with ELEVENLABS_API_KEY that is ElevenLabs eleven_v3 with the configured documentary narrator (delivery steered by a v3 audio tag; `instructions` are not sent to it), otherwise Grok Voice via OpenRouter (which does honor `instructions`). One call per line: an ad's six lines become six clips you can move and level separately. Costs credits (ElevenLabs ~$0.30, Grok ~$0.015 per 1k characters). Returns the clip id + duration and the updated project. (The raw route only files the clip in the media bucket, where the render and the checks never see it — this tool puts it on the timeline.)",
      inputSchema: {
        projectId: z.string(),
        text: z.string().min(1).max(2000),
        offsetS: z.number().min(0).describe("timeline second the line starts"),
        voice: z.string().optional().describe("leave unset for the house voice. ElevenLabs: a voice id (the catalogue lists the documentary narrator and George); Grok: ara | eve | rex | sal | leo. A voice name from the other provider falls back to the default voice rather than failing."),
        instructions: z.string().max(500).optional().describe("delivery notes the model may honor: pace, tone, mood, narrative context. For the final sentence of a monologue or film, explicitly direct its emotional landing and closing cadence; do not treat every chunk ending as a narrative ending. Keep these directions out of spoken text. ElevenLabs v3 ignores this field (its delivery comes from the configured audio tag)."),
        volume: z.number().min(0).max(4).optional().describe("gain on the clip (1 = as synthesized)"),
        ttsModel: z.string().optional().describe("a catalogue id (list_video_models does not cover TTS; see src/config/models.ts): elevenlabs/eleven_v3 or x-ai/grok-voice-tts-1.0. Default: the server's configured narrator."),
      },
    },
    guarded(async ({ projectId, text: line, offsetS, voice, instructions, volume, ttsModel }) => {
      const before = await snapshot(projectId);
      const known = new Set(before.segments.map((x) => x.id));
      // No defaults here: the server decides the narrator (src/lib/tts/synthesize.ts),
      // so every host — the app, the job worker and this tool — uses the same voice.
      const after = await api.post<Snapshot>(`/api/projects/${projectId}/generate-voiceover`, {
        text: line,
        ...(ttsModel ? { ttsModel } : {}),
        ...(voice ? { voice } : {}),
        ...(instructions ? { instructions } : {}),
      });
      const bucket = after.segments.find((x) => !known.has(x.id) && x.audioOnly);
      if (!bucket?.sourceAssetId) throw new Error("TTS produced no clip");
      const placed = await api.post<Snapshot>(`/api/projects/${projectId}/segments`, {
        source: "UPLOAD_VIDEO",
        sourceAssetId: bucket.sourceAssetId,
        audioOnly: true,
        muted: false,
        trimStartS: 0,
        durationS: bucket.durationS,
        offsetS,
        ...(volume != null ? { volume } : {}),
      });
      await api.del(`/api/projects/${projectId}/segments/${bucket.id}`).catch(() => null);
      const clip = placed.segments.find((x) => x.audioOnly && !x.library && x.sourceAssetId === bucket.sourceAssetId && Math.abs(x.offsetS - offsetS) < 1e-6);
      const s = await snapshot(projectId);
      return text({ clipId: clip?.id ?? null, assetId: bucket.sourceAssetId, durationS: bucket.durationS, offsetS, endS: +(offsetS + bucket.durationS).toFixed(3), text: line, project: summarize(s) });
    }),
  );
}
