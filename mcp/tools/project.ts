import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, type Snapshot, snapshot, summarize } from "../client";
import { guarded, text } from "../format";

const PRESETS: Record<string, { w: number; h: number; label: string }> = {
  "1080p": { w: 1920, h: 1080, label: "YouTube / landscape 1080p" },
  "4k": { w: 3840, h: 2160, label: "4K UHD landscape" },
  "720p": { w: 1280, h: 720, label: "landscape 720p" },
  vertical: { w: 1080, h: 1920, label: "Shorts / Reels / TikTok" },
  square: { w: 1080, h: 1080, label: "square 1:1" },
  "4:5": { w: 1080, h: 1350, label: "Instagram portrait 4:5" },
  preview: { w: 640, h: 360, label: "small, fast test frame" },
};

const DEFAULT_MODELS = { llmModel: "google/gemini-3.5-flash", videoModel: "alibaba/wan-2.7", ttsModel: "x-ai/grok-voice-tts-1.0" };

export function registerProjectTools(server: McpServer) {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "All projects (newest first) with id, title, status, frame and segment count. Use the id with every other tool.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    guarded(async () => {
      const rows = await api.get<Snapshot[]>("/api/projects");
      return text(
        rows.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          frame: p.frameWidth && p.frameHeight ? `${p.frameWidth}x${p.frameHeight}` : `${p.aspectRatio}/${p.resolution}`,
          segments: p.segments?.length ?? undefined,
          updatedAt: p.updatedAt,
        })),
      );
    }),
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description:
        `Create an empty project (timeline). Pick a frame with \`preset\` (${Object.keys(PRESETS).join(", ")}) or explicit width/height. ` +
        "audioMode NONE (default) means the clips' own audio, music and overlays make the soundtrack; UPLOAD_AUDIO for a master voice track you upload; TTS_FROM_SCRIPT to synthesize narration from voScript (costs credits).",
      inputSchema: {
        title: z.string().min(1).max(200),
        preset: z.enum(Object.keys(PRESETS) as [string, ...string[]]).optional(),
        width: z.number().int().min(128).max(7680).optional(),
        height: z.number().int().min(128).max(4320).optional(),
        audioMode: z.enum(["NONE", "UPLOAD_AUDIO", "TTS_FROM_SCRIPT", "TTS_VERBATIM"]).default("NONE"),
        exportCodec: z.enum(["h264", "hevc", "av1", "vp9", "prores"]).optional(),
      },
    },
    guarded(async ({ title, preset, width, height, audioMode, exportCodec }) => {
      const frame = preset ? PRESETS[preset] : width && height ? { w: width, h: height } : PRESETS["1080p"];
      const created = await api.post<Snapshot>("/api/projects", {
        title,
        targetLengthS: 30,
        aspectRatio: frame.w === frame.h ? "R1_1" : frame.h > frame.w ? "R9_16" : "R16_9",
        resolution: "R1080P",
        frameWidth: frame.w,
        frameHeight: frame.h,
        shotCount: 5,
        audioMode,
        ...(exportCodec ? { exportCodec } : {}),
        ...DEFAULT_MODELS,
      });
      if (exportCodec) await api.patch(`/api/projects/${created.id}`, { exportCodec });
      return text(summarize(await snapshot(created.id)));
    }),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Compact view of a project: frame, look, captions, every segment (id, track, trim, duration, speed, muted, effects), overlays, render state and the total timeline length.",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId }) => text(summarize(await snapshot(projectId)))),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project settings",
      description:
        "Patch project-level settings. Common fields: title, exportCodec (h264|hevc|av1|vp9|prores), colorLook (NONE|WARM|COOL|VINTAGE|…), transition (NONE|CROSSFADE|…) + transitionMs, fillMode (LETTERBOX|BLUR_FILL), vignette, grain (0-100), " +
        "captionsEnabled + captionStyle (OUTLINE|BOX|POP) + captionPosition + captionSizePct, safeArea (auto|web|broadcast|social|square|none — where text may sit; auto picks by aspect), audioNormalize, audioFadeInS/audioFadeOutS, musicVolume/musicDucking/musicMuted, voScript (narration text for TTS modes), frameWidth/frameHeight. Unknown fields are rejected by the server.",
      inputSchema: { projectId: z.string(), patch: z.record(z.string(), z.unknown()) },
    },
    guarded(async ({ projectId, patch }) => text(summarize(await api.patch<Snapshot>(`/api/projects/${projectId}`, patch)))),
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description: "Soft-delete a project (it disappears from lists; media stays on disk until cleanup).",
      inputSchema: { projectId: z.string() },
      annotations: { destructiveHint: true },
    },
    guarded(async ({ projectId }) => {
      await api.del(`/api/projects/${projectId}`);
      return text({ deleted: projectId });
    }),
  );
}
