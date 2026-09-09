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

  installActivityFeed(server);
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

/**
 * The agent lane: report every tool call (start / end) to the app so an open
 * editor can show what the agent is doing. Fire-and-forget, one tiny POST per
 * call; SLOPSTUDIO_AGENT_FEED=0 turns it off. The project is taken from the
 * call's projectId (or assetId, resolved server-side).
 */
function installActivityFeed(server: McpServer) {
  if (process.env.SLOPSTUDIO_AGENT_FEED === "0" || process.env.SLOPSTUDIO_AGENT_FEED === "false") return;
  const agent = process.env.SLOPSTUDIO_AGENT_NAME ?? "agent";
  const brief = (v: unknown): unknown => {
    if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
    if (Array.isArray(v)) return v.length > 6 ? `[${v.length} items]` : v.map(brief);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length > 12) return `{${keys.length} fields}`;
      return Object.fromEntries(keys.map((k) => [k, brief(o[k])]));
    }
    return v;
  };
  const post = (body: Record<string, unknown>) => void api.post("/api/activity", body).catch(() => null);
  // One human line per result: the numbers a person watching wants, not JSON.
  const summarize = (name: string, r: { content?: { type: string; text?: string }[]; isError?: boolean }): string => {
    const t = r.content?.find((c) => c.type === "text")?.text ?? (r.content?.some((c) => c.type === "image") ? "(image)" : "");
    const clip = (x: string, n = 220) => (x.length > n ? x.slice(0, n - 1) + "…" : x);
    const flat = (x: string) => x.replace(/\s+/g, " ").trim();
    if (r.isError) return clip(flat(t));
    let j: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(t) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) j = parsed as Record<string, unknown>;
    } catch {
      /* plain text */
    }
    const n = (v: unknown) => (typeof v === "number" ? v : null);
    const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
    const findings = (o: Record<string, unknown>) => {
      const f = arr(o.findings) as { severity?: string; message?: string }[];
      const errs = f.filter((x) => x.severity === "error").length;
      const head = f[0]?.message ? ` · ${f[0].message}` : "";
      return `${o.pass === false || errs ? `${errs} error(s), ` : ""}${f.length} finding(s)${head}`;
    };
    const snap = (o: Record<string, unknown>) => {
      const segs = arr(o.segments) as { audioOnly?: boolean; library?: boolean; track?: number }[];
      const shots = segs.filter((x) => !x.audioOnly && !x.library && (x.track ?? 0) === 0).length;
      const audio = segs.filter((x) => x.audioOnly && !x.library).length;
      return `${o.title ?? "project"} · ${o.status ?? ""} · ${n(o.timelineDurationS) ?? "?"} s · ${shots} shots${audio ? ` · ${audio} audio clips` : ""}`;
    };
    if (j) {
      const video = j.video as { width?: number; height?: number } | undefined;
      switch (name) {
        case "render_draft":
        case "draft_result":
          return j.started ? "draft render started" : `draft ready · ${n(j.durationS)} s · ${video?.width ?? "?"}×${video?.height ?? "?"}`;
        case "render_final":
        case "final_result":
          return j.started ? "final render started" : `final ready · ${n(j.durationS)} s · ${video?.width ?? "?"}×${video?.height ?? "?"}${n(j.sizeBytes) ? ` · ${(n(j.sizeBytes)! / 1e6).toFixed(1)} MB` : ""}`;
        case "check_mix_levels": {
          const p = j.program as { integratedLufs?: number; truePeakDb?: number } | undefined;
          const sp = j.speech as { medianLufs?: number } | undefined;
          const mo = j.musicOnly as { medianLufs?: number | null } | undefined;
          return `program ${p?.integratedLufs ?? "?"} LUFS / ${p?.truePeakDb ?? "?"} dBTP · speech ${sp?.medianLufs ?? "—"} · music alone ${mo?.medianLufs ?? "—"} · gap ${j.gapLu ?? "—"} LU · ${findings(j)}`;
        }
        case "balance_music":
          return `musicVolume ${j.musicVolume} (voice ${j.voiceIntegratedLufs} LUFS, music ${j.musicIntegratedLufs} LUFS, gap ${j.gapLu} LU)`;
        case "check_soundtrack":
        case "check_cuts":
        case "verify_export":
        case "pacing_report":
        case "check_beat_alignment":
        case "check_plan":
          return `${j.pass === false ? "FAIL" : j.pass === true ? "pass" : "done"} · ${findings(j)}`;
        case "apply_edit_list": {
          const proj = j.project as Record<string, unknown> | undefined;
          return `${j.applied} op(s) applied · ${arr(j.createdSegmentIds).length} created${proj ? ` → ${snap(proj)}` : ""}`;
        }
        case "transcribe":
          return j.running ? "transcribing…" : `${arr(j.words).length || "?"} words · ${arr(j.segments).length} segments${j.cached ? " (cached)" : ""}`;
        case "detect_scenes":
          return `${arr(j.cuts).length} cuts · ${arr(j.shots).length} shots`;
        case "detect_silences":
          return `${arr(j.silences).length} silences · ${arr(j.speech).length} speech ranges`;
        case "search_youtube": {
          const c = arr(j.candidates) as { title?: string; durationS?: number }[];
          return `${c.length} candidates${c[0] ? ` · top: ${clip(String(c[0].title), 80)} (${c[0].durationS ?? "?"} s)` : ""}`;
        }
        case "source_clips": {
          const res = arr(j.results) as { status?: string }[];
          return `${res.filter((x) => x.status === "importing").length} importing · ${res.filter((x) => x.status === "failed" || x.status === "no results").length} failed · ${arr(j.remaining).length} remaining`;
        }
        case "set_plan": {
          const plan = j.plan as { version?: number } | undefined;
          const check = j.check as Record<string, unknown> | undefined;
          return `plan v${plan?.version ?? "?"} stored · ${check ? (check.pass ? "check pass" : "check FAIL") + " · " + findings(check) : ""}`;
        }
        case "approve_plan":
          return "plan approved";
        case "plan_tasks":
          return `${arr(j.tasks).length} tasks · ${arr(j.parallelNow).length} can start now: ${arr(j.parallelNow).join(", ")}`;
        case "generate_narration":
          return `"${clip(String(j.text ?? ""), 60)}" · ${n(j.durationS)} s at ${n(j.offsetS)} s`;
        case "add_ai_shot":
          return `${j.model} · ${n(j.durationS)} s · generating`;
        case "set_brief":
          return "brief stored";
        case "create_checkpoint":
          return `checkpoint ${j.id ?? ""}`;
        case "import_media":
          return `${j.kind ?? "asset"} ${j.id ?? ""}${n(j.durationS) ? ` · ${n(j.durationS)} s` : ""}`;
        default:
          if (Array.isArray(j.segments) && "timelineDurationS" in j) return snap(j);
      }
    }
    return clip(flat(t));
  };
  type Cb = (args: Record<string, unknown>, extra: unknown) => Promise<{ content?: { type: string; text?: string }[]; isError?: boolean }>;
  const orig = server.registerTool.bind(server) as unknown as (name: string, config: unknown, cb: Cb) => unknown;
  (server as unknown as { registerTool: unknown }).registerTool = (name: string, config: unknown, cb: Cb) =>
    orig(name, config, async (args, extra) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const ids = { projectId: typeof a.projectId === "string" ? a.projectId : undefined, assetId: typeof a.assetId === "string" ? a.assetId : undefined };
      const callId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const t0 = Date.now();
      if (ids.projectId || ids.assetId) post({ ...ids, callId, phase: "start", tool: name, args: brief(a), agent });
      try {
        const r = await cb(args, extra);
        if (ids.projectId || ids.assetId) post({ ...ids, callId, phase: "end", tool: name, ok: !r.isError, ms: Date.now() - t0, summary: summarize(name, r), agent });
        return r;
      } catch (e) {
        if (ids.projectId || ids.assetId) post({ ...ids, callId, phase: "end", tool: name, ok: false, ms: Date.now() - t0, summary: e instanceof Error ? e.message : String(e), agent });
        throw e;
      }
    });
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
