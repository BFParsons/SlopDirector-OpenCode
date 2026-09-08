import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, assetInfo, snapshot, waitForRender } from "../client";
import { guarded, text } from "../format";

export function registerRenderTools(server: McpServer) {
  server.registerTool(
    "render_draft",
    {
      title: "Render a draft preview",
      description:
        "Fast low-resolution (≤640×360) preview of the current timeline with every effect, caption and mix applied — seconds, not minutes, and free. Waits for it by default and returns the draft asset id + file path; then use get_frame / get_contact_sheet / detect_silences on that asset to check the result.",
      inputSchema: { projectId: z.string(), wait: z.boolean().default(true), timeoutS: z.number().int().min(5).max(1800).default(300) },
    },
    guarded(async ({ projectId, wait, timeoutS }) => {
      const prev = (await snapshot(projectId)).finalRender?.draftAssetId ?? null;
      await api.post(`/api/projects/${projectId}/render`, { draft: true });
      if (!wait) return text({ started: true, draft: true, hint: "poll render_status" });
      const t0 = Date.now();
      const s = await waitForRender(projectId, true, timeoutS, prev);
      const id = s.finalRender!.draftAssetId!;
      const info = await assetInfo(id);
      return text({ draftAssetId: id, durationS: info.durationS, video: info.video, path: info.path, renderMs: Date.now() - t0 });
    }),
  );

  server.registerTool(
    "render_final",
    {
      title: "Render the final export",
      description:
        "Full-quality export at the project's frame and codec. Generates any AI shots / TTS narration first (those cost credits and can take minutes); pure edits of uploaded media assemble in seconds. Returns the final asset id and its file path.",
      inputSchema: { projectId: z.string(), wait: z.boolean().default(true), timeoutS: z.number().int().min(5).max(7200).default(1800) },
    },
    guarded(async ({ projectId, wait, timeoutS }) => {
      const r = await api.post<{ estCostCents?: number }>(`/api/projects/${projectId}/render`, {});
      if (!wait) return text({ started: true, estCostCents: r.estCostCents ?? 0, hint: "poll render_status" });
      const t0 = Date.now();
      const s = await waitForRender(projectId, false, timeoutS, null);
      const id = s.finalRender!.assetId!;
      const info = await assetInfo(id);
      return text({ assetId: id, durationS: info.durationS, video: info.video, sizeBytes: info.sizeBytes, path: info.path, renderMs: Date.now() - t0 });
    }),
  );

  server.registerTool(
    "render_status",
    {
      title: "Render status",
      description: "Project status (DRAFT / RENDERING / DONE / FAILED), render progress %, error, and the current final and draft asset ids.",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId }) => {
      const s = await snapshot(projectId);
      return text({ status: s.status, error: s.error, finalRender: s.finalRender, segmentStatuses: s.segments.map((x) => ({ id: x.id, status: x.status, error: x.error })) });
    }),
  );

  server.registerTool(
    "cancel_render",
    { title: "Cancel render", inputSchema: { projectId: z.string() } },
    guarded(async ({ projectId }) => text(await api.post(`/api/projects/${projectId}/cancel`, {}))),
  );

  server.registerTool(
    "export_formats",
    {
      title: "Export formats",
      description: "Which codecs this machine can export (H.264, HEVC, AV1, VP9, ProRes) and whether each runs on the GPU; plus the cost preview of a full render.",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId }) => text(await api.get(`/api/projects/${projectId}/render`))),
  );
}
