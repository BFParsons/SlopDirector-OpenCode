import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_TOOL_WAIT_S, api, assetInfo, snapshot, waitForRender } from "../client";
import { guarded, text } from "../format";

export function registerRenderTools(server: McpServer) {
  server.registerTool(
    "render_draft",
    {
      title: "Render a draft preview",
      description:
        `Fast low-resolution (≤640×360) preview of the current timeline with every effect, caption and mix applied — seconds, not minutes, and free. Waits up to ${MAX_TOOL_WAIT_S} s and returns the draft asset id + file path; a longer render returns {started:true} — call render_status, then draft_result. Then use get_frame / get_contact_sheet / detect_silences on the draft asset to check the result.`,
      inputSchema: { projectId: z.string(), wait: z.boolean().default(true) },
    },
    guarded(async ({ projectId, wait }) => {
      const prev = (await snapshot(projectId)).finalRender?.draftAssetId ?? null;
      await api.post(`/api/projects/${projectId}/render`, { draft: true });
      if (!wait) return text({ started: true, draft: true, hint: "poll render_status; then draft_result" });
      const t0 = Date.now();
      const s = await waitForRender(projectId, true, MAX_TOOL_WAIT_S, prev);
      if (!s) {
        const st = await snapshot(projectId);
        return text({ started: true, draft: true, stillRendering: true, progress: st.finalRender?.progress ?? 0, hint: "still rendering — call render_status until it is not RENDERING, then draft_result for the asset id and path" });
      }
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
        `Full-quality export at the project's frame and codec. Generates any AI shots / TTS narration first (those cost credits and can take minutes); pure edits of uploaded media assemble in seconds to minutes. Waits up to ${MAX_TOOL_WAIT_S} s; a longer render returns {started:true} — poll render_status, then final_result. Returns the final asset id and its file path.`,
      inputSchema: { projectId: z.string(), wait: z.boolean().default(true) },
    },
    guarded(async ({ projectId, wait }) => {
      const r = await api.post<{ estCostCents?: number }>(`/api/projects/${projectId}/render`, {});
      if (!wait) return text({ started: true, estCostCents: r.estCostCents ?? 0, hint: "poll render_status; then final_result" });
      const t0 = Date.now();
      const s = await waitForRender(projectId, false, MAX_TOOL_WAIT_S, null);
      if (!s) {
        const st = await snapshot(projectId);
        return text({ started: true, stillRendering: true, progress: st.finalRender?.progress ?? 0, hint: "still rendering — call render_status until DONE, then final_result for the asset id and path" });
      }
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

  for (const [name, draft] of [["draft_result", true], ["final_result", false]] as const) {
    server.registerTool(
      name,
      {
        title: draft ? "Draft result" : "Final result",
        description: draft ? "The latest draft preview's asset id, duration, video stream and file path (after render_draft reported stillRendering)." : "The latest final export's asset id, duration, video stream, size and file path (after render_final reported stillRendering).",
        inputSchema: { projectId: z.string() },
        annotations: { readOnlyHint: true },
      },
      guarded(async ({ projectId }) => {
        const s = await snapshot(projectId);
        if (s.status === "RENDERING") return text({ stillRendering: true, progress: s.finalRender?.progress ?? 0, hint: "call render_status until it is not RENDERING" });
        const id = draft ? s.finalRender?.draftAssetId : s.finalRender?.assetId;
        if (!id) throw new Error(draft ? "no draft yet — render_draft first" : "no final yet — render_final first");
        const info = await assetInfo(id);
        return text(draft ? { draftAssetId: id, durationS: info.durationS, video: info.video, path: info.path } : { assetId: id, durationS: info.durationS, video: info.video, sizeBytes: info.sizeBytes, path: info.path });
      }),
    );
  }

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
