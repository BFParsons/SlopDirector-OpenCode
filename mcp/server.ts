#!/usr/bin/env node
/**
 * SlopStudio MCP server — lets Claude / Codex / any MCP client edit video in a
 * running SlopStudio over its HTTP API (stdio transport).
 *
 *   SLOPSTUDIO_URL        http://127.0.0.1:38473 (desktop app or `pnpm serve:headless`)
 *   SLOPSTUDIO_API_TOKEN  bearer token for a non-desktop server (optional)
 *
 * Never write to stdout here — it is the protocol channel. Log to stderr.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { api, BASE, type Snapshot, snapshot, summarize } from "./client";
import { registerInspectTools } from "./tools/inspect";
import { registerMediaTools } from "./tools/media";
import { registerProjectTools } from "./tools/project";
import { registerRenderTools } from "./tools/render";
import { registerTimelineTools } from "./tools/timeline";

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: "slopstudio", version: "0.1.0" },
    {
      instructions:
        "SlopStudio is a video editor. Typical loop: create_project (or list_projects) → import_media → look with get_contact_sheet / detect_scenes / detect_silences / transcribe → " +
        "create_checkpoint → cut with add_segment (same asset, different trimStartS/durationS) + update_segments / apply_edit_list → render_draft and inspect the draft asset with get_frame / detect_silences → " +
        "iterate or restore_checkpoint → render_final and hand the person the returned file path. Times are seconds. Segment ids come from get_project.",
    },
  );

  registerProjectTools(server);
  registerMediaTools(server);
  registerInspectTools(server);
  registerTimelineTools(server);
  registerRenderTools(server);

  server.registerResource(
    "projects",
    "slopstudio://projects",
    { title: "Projects", description: "All projects (compact)", mimeType: "application/json" },
    async (uri) => {
      const rows = await api.get<Snapshot[]>("/api/projects");
      const list = rows.map((p) => ({ id: p.id, title: p.title, status: p.status, updatedAt: p.updatedAt }));
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(list, null, 2) }] };
    },
  );
  server.registerResource(
    "project",
    new ResourceTemplate("slopstudio://projects/{projectId}", { list: undefined }),
    { title: "Project", description: "Compact project view (same as get_project)", mimeType: "application/json" },
    async (uri, { projectId }) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(summarize(await snapshot(String(projectId))), null, 2) }],
    }),
  );

  server.registerPrompt(
    "edit_video",
    {
      title: "Edit a video",
      description: "A playbook for turning a source clip into a finished edit with these tools.",
      argsSchema: { goal: z.string().describe("what the finished video should be"), projectId: z.string().optional() },
    },
    ({ goal, projectId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Goal: ${goal}\n` +
              (projectId ? `Project: ${projectId} (call get_project first).\n` : "Start with list_projects or create_project, then import_media.\n") +
              "Work like an editor: 1) perceive the source (get_contact_sheet, detect_scenes, detect_silences, transcribe) before cutting; " +
              "2) create_checkpoint; 3) express the cut as segments (same asset, trimStartS + durationS per kept range; muted=false to keep clip sound) — prefer apply_edit_list for multi-step changes; " +
              "4) render_draft, then LOOK at the draft (get_frame / get_contact_sheet) and LISTEN (detect_silences on the draft asset); " +
              "5) fix or restore_checkpoint; 6) only when the draft is right, render_final and report the file path. Keep the person informed of the cut you chose and why.",
          },
        },
      ],
    }),
  );

  return server;
}

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[slopstudio-mcp] ready · SlopStudio at ${BASE}${process.env.SLOPSTUDIO_API_TOKEN ? " (bearer token)" : ""}`);
}

const isMain = process.argv[1] && /server\.(ts|js|mjs)$/.test(process.argv[1]);
if (isMain) {
  main().catch((e) => {
    console.error("[slopstudio-mcp] fatal:", e);
    process.exit(1);
  });
}
