import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, type Snapshot, assetInfo, summarize } from "../client";
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
}
