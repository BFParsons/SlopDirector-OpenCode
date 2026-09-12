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
import { interviewBatch, nextQuestion } from "../interview";
import { INTERVIEW_UI } from "../interview-ui";
import { styleText } from "../guide";
import { CATEGORIES, STYLES, styleById, stylesFor } from "../../src/lib/styles";
import { guarded, image, text } from "../format";

type Check = { pass: boolean; findings: { severity: string; rule: string; message: string; ref?: string }[]; summary: Record<string, unknown> };

export function registerPreproductionTools(server: McpServer) {
  server.registerTool(
    "interview_batch",
    {
      title: "Gather the film brief",
      description:
        "Prefetch the interview queue: returns all currently applicable unanswered questions in one call, or done with the finished brief. Cache the questions and present them one at a time with minimal processing between replies; submit accumulated answers when the queue is exhausted. Scene context, supplied material text, footage licence and music selection/reference questions may appear after their parent answers. " + INTERVIEW_UI,
      inputSchema: { request: z.string().min(1).max(4000).describe("what the person asked for, verbatim"), answers: z.record(z.string(), z.unknown()).default({}).describe("all answers so far, keyed by question id; include information already supplied") },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ request, answers }) => text(interviewBatch(request, answers))),
  );

  server.registerTool(
    "interview_next",
    {
      title: "Next interview question",
      description:
        "Compatibility fallback for clients that cannot retain a question queue. For a faster one-question-at-a-time interview, prefetch interview_batch and advance locally instead of calling this tool after each answer. Pass the person's request and answers so far ({questionId: value}); get the next question or the finished brief to pass to set_brief. " + INTERVIEW_UI,
      inputSchema: { request: z.string().min(1).max(4000).describe("what the person asked for, verbatim"), answers: z.record(z.string(), z.unknown()).default({}).describe("answers so far, keyed by question id") },
    },
    guarded(async ({ request, answers }) => text(nextQuestion(request, answers))),
  );

  server.registerTool(
    "list_styles",
    {
      title: "List directing styles",
      description:
        "The directing styles the interview can offer — real filmmakers and houses (Adam Curtis, Ken Burns, Ridley Scott, Michel Gondry, Wes Anderson, Frank Capra, Mark Woollen, MrBeast…) translated into editorial defaults the harness reviews (ASL range, shot floor, transitions, narration policy / voice / words-per-minute, music policy / kind, sync policy, text, stills, interviews, beat-cut) and prose the agent follows (get_style). Pass a genre / form to see which fit it (all otherwise), grouped by category.",
      inputSchema: { genre: z.string().max(200).optional().describe("the brief's genre / form, e.g. 'scripted historical documentary', 'attack ad', 'music video', 'trailer', 'vlog'") },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ genre }) => {
      const fits = genre ? new Set(stylesFor(genre).map((x) => x.id)) : null;
      const rows = STYLES.filter((x) => !fits || fits.has(x.id)).map((x) => ({ id: x.id, name: x.name, category: x.category, oneLine: x.oneLine, params: x.params, parameterBasis: x.parameterBasis, reference: x.craft?.reference ?? null, materialFit: x.craft?.materialFit ?? null }));
      return text({ genre: genre ?? null, count: rows.length, categories: CATEGORIES.map((c) => ({ ...c, styles: rows.filter((r) => r.category === c.id).map((r) => r.id) })).filter((c) => c.styles.length), styles: rows });
    }),
  );

  server.registerTool(
    "get_style",
    {
      title: "Read a directing style",
      description:
        "Read a directing reference: documented mechanism, source evidence, material prerequisites, shot selection, framing, rhythm, sound, typography, exceptions and an observable evaluation. Includes the shared director-style playbook. Parameters are editorial starting defaults, not career-wide prohibitions. Use the craft fields to write plan.styleTreatment before planning the shots.",
      inputSchema: { id: z.string().min(1).max(60).describe("a style id from list_styles, e.g. adam-curtis") },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ id }) => {
      const st = styleById(id);
      const doc = styleText(id);
      if (!st && !doc) throw new Error(`unknown style "${id}" — list_styles has the registry`);
      return text({ id, name: st?.name ?? doc?.title ?? id, category: st?.category ?? null, oneLine: st?.oneLine ?? null, params: st?.params ?? null, parameterBasis: st?.parameterBasis ?? null, craft: st?.craft ?? null, text: doc?.text ?? null });
    }),
  );

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
      description: "The plan as the person reads it in a terminal. Default 'table': box-drawn tables — beats, then a two-column AV script (one row per shot: # / at / len / sound / VIDEO = picture, source, card / AUDIO = the narration and bite lines over it), clips to find, AI shots — followed by music, narration, risks and the check. 'list' is the same as an indented list; 'markdown' has markdown tables (also written to plan-v<N>.md). Paste the output into your reply VERBATIM inside a code block, do not summarize it (RULES 2: propose-and-approve).",
      inputSchema: { projectId: z.string(), format: z.enum(["table", "list", "markdown"]).default("table"), width: z.number().int().min(80).max(200).default(110).describe("table: total columns") },
    },
    guarded(async ({ projectId, format, width }) => {
      const r =
        format === "markdown"
          ? await api.get<{ markdown: string; check: Check }>(`/api/projects/${projectId}/plan?view=document`).then((x) => ({ body: x.markdown, check: x.check }))
          : await api.get<{ text: string; check: Check }>(`/api/projects/${projectId}/plan?view=${format === "list" ? "cli" : `table&width=${width}`}`).then((x) => ({ body: x.text, check: x.check }));
      const errs = r.check.findings.filter((f) => f.severity === "error");
      return text(`${r.body}\n${format === "markdown" ? "---\n" : ""}CHECK: ${r.check.pass ? "PASS" : `${errs.length} error(s)`}${r.check.findings.length ? "\n" + r.check.findings.map((f) => `  ${f.severity}: ${f.message}`).join("\n") : ""}`);
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
      description: "One captioned frame per shot of the main sequence (index · start · length · sync/mute · title card) tiled as a storyboard — for YOUR eyes when reviewing a cut (the person's terminal shows no images: give them the file path and the shot list in text). Needs shots on the timeline.",
      inputSchema: { projectId: z.string(), cols: z.number().int().min(1).max(8).default(4), width: z.number().int().min(160).max(960).default(400).describe("cell width in px") },
    },
    guarded(async ({ projectId, cols, width }) => {
      const { bytes, contentType, headers } = await api.bytes(`/api/projects/${projectId}/storyboard?cols=${cols}&w=${width}`);
      const file = decodeURI(headers.get("x-storyboard-file") ?? "");
      return image(bytes, contentType, `Shots left→right, top→bottom: ${headers.get("x-storyboard-shots") ?? ""}${file ? `\nfile: ${file} (the person can open this; a terminal shows no images — describe the shots in text)` : ""}`);
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
