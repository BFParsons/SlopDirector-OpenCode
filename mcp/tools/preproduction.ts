/**
 * Pre-production: the brief (what the person wants), the plan (what the
 * editor proposes: beats, script, storyboard, clip list, AI shots), its
 * mechanical check, the document for approval, the task graph to fan out,
 * and the storyboard sheet of the cut once shots exist.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { briefSchema, planSchema } from "../../src/lib/validation/brief";
import { api } from "../client";
import { guarded, image, text } from "../format";

type Check = { pass: boolean; findings: { severity: string; rule: string; message: string; ref?: string }[]; summary: Record<string, unknown> };

export function registerPreproductionTools(server: McpServer) {
  server.registerTool(
    "set_brief",
    {
      title: "Store the brief",
      description:
        "Record the outcome of the interview (guide Part II §11, playbook 'preproduction'): standalone piece or a scene of a longer video, length, aspect; scripted or not and the genre; where footage comes from (youtube / ai / upload / stock); premise; tone; audience; must-include / avoid; narration, music and text wanted. Stored on the project; status 'draft' until approve_plan. Replaces the whole brief — pass everything.",
      inputSchema: { projectId: z.string(), brief: briefSchema },
    },
    guarded(async ({ projectId, brief }) => text(await api.put(`/api/projects/${projectId}/brief`, brief))),
  );

  server.registerTool(
    "get_brief",
    { title: "Read the brief", description: "The stored brief (null until set_brief).", inputSchema: { projectId: z.string() } },
    guarded(async ({ projectId }) => text(await api.get(`/api/projects/${projectId}/brief`))),
  );

  server.registerTool(
    "set_plan",
    {
      title: "Propose a plan",
      description:
        "Store the proposed plan — logline, beats (contiguous, cover the runtime), script lines (narration / bite / text with atS), shots in order (durationS, description, source {youtube+clipId | ai+prompt | upload | card}, sound sync|muted|vo, text, transition), clipList (what to search for, per clip), aiShots (prompt + model + length per AI shot), music, narration voice. Validated, versioned (v1, v2…), status 'proposed'; returns the mechanical check (length vs brief, pacing norm, sources, narration density and overlaps, caps, AI cost) and the path of plan-v<N>.md. Fix every error, then show the person plan_document and wait for their yes before approve_plan.",
      inputSchema: { projectId: z.string(), plan: planSchema },
    },
    guarded(async ({ projectId, plan }) => text(await api.put(`/api/projects/${projectId}/plan`, plan))),
  );

  server.registerTool(
    "get_plan",
    { title: "Read the plan", description: "The stored plan with the brief and the current check (null until set_plan).", inputSchema: { projectId: z.string() } },
    guarded(async ({ projectId }) => text(await api.get(`/api/projects/${projectId}/plan`))),
  );

  server.registerTool(
    "check_plan",
    {
      title: "Check the plan",
      description: "Mechanical check of the stored plan against the brief: total length, average shot length vs the genre norm (ch.16), beats, every shot's source resolvable, narration density (≤ 2 w/s) and overlaps, narration over sync-sound shots, caps (segments, AI shots, text cards), AI generation cost, scene-of-a-longer-video constraints. Errors block approval.",
      inputSchema: { projectId: z.string() },
    },
    guarded(async ({ projectId }) => text(await api.get<Check>(`/api/projects/${projectId}/plan?view=check`))),
  );

  server.registerTool(
    "plan_document",
    {
      title: "The plan as a document",
      description: "Markdown of the plan for the person to read and approve: brief, logline, beats, storyboard table (shot / source / sound / card), script with times, clips to find, AI prompts, music, narration, risks. Show it to them verbatim (RULES 2: propose-and-approve).",
      inputSchema: { projectId: z.string() },
    },
    guarded(async ({ projectId }) => {
      const r = await api.get<{ markdown: string; check: Check }>(`/api/projects/${projectId}/plan?view=document`);
      const errs = r.check.findings.filter((f) => f.severity === "error");
      return text(`${r.markdown}\n---\ncheck: ${r.check.pass ? "PASS" : `${errs.length} error(s)`}${r.check.findings.length ? "\n" + r.check.findings.map((f) => `- ${f.severity}: ${f.message}`).join("\n") : ""}`);
    }),
  );

  server.registerTool(
    "approve_plan",
    {
      title: "Approve the plan",
      description: "Record the person's approval of the current plan (and brief). Call ONLY after they said yes to plan_document. Sourcing, generation and cutting follow from an approved plan.",
      inputSchema: { projectId: z.string() },
    },
    guarded(async ({ projectId }) => text(await api.post(`/api/projects/${projectId}/plan/approve`, {}))),
  );

  server.registerTool(
    "plan_tasks",
    {
      title: "Task graph from the plan",
      description:
        "The approved plan as tasks with dependencies: one 'source:<clipId>' per clip to find, one 'ai:<shotId>' per AI shot, 'narration' (all lines), 'music' — none of these depend on each other, so run them in parallel (sub-agents, or source_clips / generate_ai_shots / generate_narration in a batch); then 'assemble' (needs all of them), 'titles', 'checks', 'draft', 'final'. `parallelNow` lists what can start immediately.",
      inputSchema: { projectId: z.string() },
    },
    guarded(async ({ projectId }) => text(await api.get(`/api/projects/${projectId}/plan?view=tasks`))),
  );

  server.registerTool(
    "storyboard_sheet",
    {
      title: "Storyboard of the cut",
      description: "One captioned frame per shot of the main sequence (index · start · length · sync/mute · title card) tiled as a storyboard — the picture to review a cut with, and to send the person before the draft. Needs shots on the timeline.",
      inputSchema: { projectId: z.string(), cols: z.number().int().min(1).max(8).default(4), width: z.number().int().min(160).max(960).default(400).describe("cell width in px") },
    },
    guarded(async ({ projectId, cols, width }) => {
      const { bytes, contentType, headers } = await api.bytes(`/api/projects/${projectId}/storyboard?cols=${cols}&w=${width}`);
      return image(bytes, contentType, `Shots left→right, top→bottom: ${headers.get("x-storyboard-shots") ?? ""}`);
    }),
  );

  server.registerTool(
    "list_video_models",
    {
      title: "Generation models",
      description: "The AI video models this build can generate with (id, label, price per second, clip lengths, notes such as public-figure blocks), plus TTS voices and chat models.",
      inputSchema: {},
    },
    guarded(async () => text(await api.get(`/api/models`))),
  );
}
