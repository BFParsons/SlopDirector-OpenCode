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
import { registerVerifyTools } from "./tools/verify";
import { registerPreproductionTools } from "./tools/preproduction";
import { registerSourcingTools } from "./tools/sourcing";
import { loadGuide, registerGuide } from "./guide";

export function buildServer(): McpServer {
  const { rules, playbooks } = loadGuide();
  const server = new McpServer(
    { name: "slopstudio", version: "0.2.0" },
    {
      instructions:
        "SlopStudio is a video editor. NEW PIECE: interview the person first (prompt `interview` / playbook `preproduction`) → set_brief → author the plan → set_plan → check_plan until it passes → plan_document to the person → their yes → approve_plan → plan_tasks → fan out the parallel tasks (source_clips or clip-scout sub-agents, generate_ai_shots, generate_narration per line, music) → assemble. EDIT LOOP: create_project (or list_projects) → import_media → LOOK (get_contact_sheet, detect_scenes, detect_silences, transcribe) → " +
        "create_checkpoint → cut (add_segment: same asset, different trimStartS/durationS; update_segments; apply_edit_list) → render_draft → CHECK (get_frame, check_cuts, pacing_report, verify_export) → " +
        "iterate or restore_checkpoint → render_final and hand over the file path. Times are seconds at 30 fps. " +
        `Playbooks for common jobs (get_playbook): ${[...playbooks.keys()].join(", ") || "none installed"}. search_guide / read_guide hold the full craft guide.\n\n` +
        rules,
    },
  );

  registerProjectTools(server);
  registerMediaTools(server);
  registerInspectTools(server);
  registerTimelineTools(server);
  registerRenderTools(server);
  registerVerifyTools(server);
  registerPreproductionTools(server);
  registerSourcingTools(server);
  registerGuide(server);

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
              `${loadGuide().rules}\n\n` +
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

  server.registerPrompt(
    "interview",
    {
      title: "Interview the person (pre-production)",
      description: "The questions that pin a new piece down before any footage is touched, asked in one round with inferred defaults, then set_brief.",
      argsSchema: { request: z.string().describe("what the person said they want, verbatim"), projectId: z.string().optional() },
    },
    ({ request, projectId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `The person asked: "${request}"\n` +
              (projectId ? `Project: ${projectId}.\n` : "Create the project once the brief is set (create_project with the right aspect/resolution).\n") +
              "\nRun the pre-production interview (playbook 'preproduction', get_playbook). Infer everything you can from the request, then ask ONE round of questions — only what is still open, at most eight, each with your proposed default in brackets so a one-word answer works:\n" +
              "a) standalone piece, or one scene of a longer video (then: what comes before/after, no sign-off) — and the length and aspect;\n" +
              "b) scripted or unscripted, and the genre / form (documentary, commercial, attack ad, explainer, trailer, montage, interview, sketch…);\n" +
              "c) where the footage comes from: YouTube, AI generation, their own files, stock — and any licence rule;\n" +
              "d) the premise in one or two sentences — what it says, what it's for;\n" +
              "e) the tone (three adjectives is enough) and the audience;\n" +
              "f) narration (voice? style?), music (yes/no, what kind), on-screen text (yes/no); anything that must be in, anything to avoid.\n" +
              "Then set_brief with the answers and continue with the 'preproduction' prompt: propose the plan (storyboard + script, AI shot list with prompts, YouTube clip list), check it, show it, wait for approval.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "preproduction",
    {
      title: "Propose the plan (storyboard, script, shot list, clip list)",
      description: "From an approved-or-draft brief, author the plan per the playbook, store and check it, present the document, wait for approval, then fan out.",
      argsSchema: { projectId: z.string() },
    },
    ({ projectId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Project ${projectId}: get_brief, then read get_playbook preproduction and write the plan.\n` +
              "1) Beats first (3–6 for a short piece), contiguous, adding up to the brief's length. 2) The script: narration lines with atS (≤ 2 words/s over the piece, never over a sync-sound bite), the sound bites you expect to find, the text cards. 3) The storyboard: shots in order, each with duration, description, source, sound decision (sync | muted | vo), card text, transition — average shot length inside the genre norm. 4) The clip list for YouTube shots (id, what it must contain, 2–3 search queries, preferred channels, the wanted moment) and the AI shot list (prompt, model from list_video_models, length the model makes). 5) Music brief + queries; narration voice.\n" +
              "set_plan → read the check → fix every error and the warnings you agree with → plan_document → paste its text into your reply VERBATIM inside a code block (it is laid out for a terminal: boxed tables, the AV script with VIDEO and AUDIO columns) and ask for a yes or changes. Do NOT source, generate or cut before approve_plan. After approval: plan_tasks, then run every task in `parallelNow` at once (sub-agents per clip for precision, source_clips for speed; generate_ai_shots; generate_narration per line; music via search_youtube + import_youtube kind=audio + set_music + balance_music), then assemble per the storyboard, titles, checks, draft, storyboard_sheet + draft to the person, final.",
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
