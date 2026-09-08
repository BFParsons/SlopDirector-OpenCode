import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_TOOL_WAIT_S, api } from "../client";
import { guarded, image, text } from "../format";

export function registerInspectTools(server: McpServer) {
  server.registerTool(
    "get_frame",
    {
      title: "Look at a frame",
      description: "One JPEG frame of a video asset at time t (seconds). Works on sources, generated clips, drafts and finals. Use it to check a cut point, a caption, an effect or the framing.",
      inputSchema: { assetId: z.string(), t: z.number().min(0), width: z.number().int().min(64).max(1920).default(640) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ assetId, t, width }) => {
      const { bytes, contentType } = await api.bytes(`/api/assets/${assetId}/frame?t=${t}&w=${width}`);
      return image(bytes, contentType, `asset ${assetId} at t=${t}s`);
    }),
  );

  server.registerTool(
    "get_contact_sheet",
    {
      title: "Contact sheet",
      description:
        "A grid of cols×rows frames sampled evenly between startS and endS (default: the whole clip), each cell stamped with its source timestamp — the fastest way to see what a clip contains before deciding where to cut. Returns the image plus the sampled times.",
      inputSchema: {
        assetId: z.string(),
        cols: z.number().int().min(1).max(10).default(4),
        rows: z.number().int().min(1).max(10).default(3),
        width: z.number().int().min(256).max(3840).default(1280),
        startS: z.number().min(0).optional(),
        endS: z.number().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ assetId, cols, rows, width, startS, endS }) => {
      const q = new URLSearchParams({ cols: String(cols), rows: String(rows), w: String(width) });
      if (startS != null) q.set("start", String(startS));
      if (endS != null) q.set("end", String(endS));
      const { bytes, contentType, headers } = await api.bytes(`/api/assets/${assetId}/contact-sheet?${q}`);
      const times = headers.get("x-frame-times") ?? "[]";
      return image(bytes, contentType, `Cells read left→right, top→bottom; source times (s): ${times}`);
    }),
  );

  server.registerTool(
    "detect_scenes",
    {
      title: "Detect scene cuts",
      description: "Shot boundaries in a video asset (ffmpeg scene score > threshold, default 0.4; lower = more sensitive). Returns cut times and the shots they delimit.",
      inputSchema: { assetId: z.string(), threshold: z.number().min(0.05).max(1).default(0.4) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ assetId, threshold }) => text(await api.get(`/api/assets/${assetId}/scenes?threshold=${threshold}`))),
  );

  server.registerTool(
    "detect_silences",
    {
      title: "Detect silences",
      description: "Silent stretches in an asset's audio (below noiseDb, default -30 dB, lasting at least minS, default 0.5 s) AND the complementary `speech` ranges — the pieces to keep when cutting dead air.",
      inputSchema: { assetId: z.string(), noiseDb: z.number().min(-90).max(0).default(-30), minS: z.number().min(0.05).max(60).default(0.5) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ assetId, noiseDb, minS }) => text(await api.get(`/api/assets/${assetId}/silences?noise=${noiseDb}&min=${minS}`))),
  );

  server.registerTool(
    "transcribe",
    {
      title: "Transcribe",
      description:
        "Whisper transcript of an asset's audio with segment and word timings (startS/endS per word) — the basis for cutting by transcript, captions and finding a quote. Cached per asset+model; `tiny`/`base` are fast, `small`+ more accurate. Long clips can take minutes.",
      inputSchema: {
        assetId: z.string(),
        model: z.enum(["tiny", "base", "small", "medium", "large-v3"]).default("base"),
        language: z.string().max(10).optional(),
        includeWords: z.boolean().default(true),
      },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ assetId, model, language, includeWords }) => {
      type T = { text: string; language: string | null; segments: unknown[]; words: unknown[]; cached: boolean; jobId?: string };
      // Cached? Return at once. Else start the job and long-poll under the MCP
      // request timeout; a slow transcript returns {running:true} — call again.
      let r: T | null = null;
      try {
        r = await api.get<T>(`/api/assets/${assetId}/transcribe?model=${model}`);
      } catch {
        const started = await api.post<T>(`/api/assets/${assetId}/transcribe`, { model, ...(language ? { language } : {}), wait: false });
        const t0 = Date.now();
        while (Date.now() - t0 < MAX_TOOL_WAIT_S * 1000) {
          await new Promise((res) => setTimeout(res, 1500));
          const job = await api.get<{ status: string; error?: string | null; progress?: number }>(`/api/audio/jobs/${started.jobId}`);
          if (job.status === "error") throw new Error(`transcription failed: ${job.error ?? "unknown"}`);
          if (job.status === "done") {
            r = await api.get<T>(`/api/assets/${assetId}/transcribe?model=${model}`);
            break;
          }
        }
        if (!r) return text({ running: true, jobId: started.jobId, hint: `transcribing with "${model}" takes longer than one call — call transcribe again with the same arguments in a minute` });
      }
      return text(includeWords ? r : { ...r, words: `(${r.words.length} words omitted; includeWords=true to get them)` });
    }),
  );
}
