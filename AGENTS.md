# SlopStudio — notes for Codex and other agents

SlopStudio is an Electron + Next.js video editor with an MCP server. Native Windows
setup and Codex instructions: `docs/WINDOWS-CODEX.md`. Run `corepack pnpm codex:setup`
once and open/trust this repository in Codex. The app must be running:
`corepack pnpm desktop:prod` (visible editor), `corepack pnpm desktop:dev` (HMR),
or `corepack pnpm serve:headless` (no window), all on localhost:38473 by default.
The stdio entry is `node <absolute-repo-path>/mcp/run.cjs`; do not launch a `.cmd`
or Unix `node_modules/.bin/tsx` shim from an MCP configuration.


After changing MCP code, the registry or guide files, verify through a fresh
MCP connection: a running stdio process can retain old modules and guide text.
If the host connection is stale, use scripts/mcp-call.ts (which launches a
fresh mcp/run.cjs) for subsequent calls until the host reconnects. Do not treat
stale get_style output as the current harness. Rebuild/reopen the desktop app
when its bundled API code changes.

## New film compositions in Codex

1. Call `list_projects` to confirm the connection. Ask which project only if the
   request does not make it clear. Use `interview_batch` directly even when the
   host does not expose MCP prompts; the `interview` prompt is optional.
2. Keep the original request and an `answers` map keyed by question id. Fill in
   information already supplied. Fetch `interview_batch` once and cache the queue;
   present exactly one short question at a time, multiple choice where practical.
   Between replies, only record the value, skip answered fields, and ask the next
   queued question. No per-answer MCP calls, research, file reads, style lookups,
   recaps or plan drafting. Use the supplied options within the host UI's limits;
   use free text for the subject, original material or custom preferences.
   Ask clip type early and director style immediately afterward. Select the
   cached style question's `optionsByGenre[answers.genre]` locally (closest
   cached genre for a custom type). Offer three named styles with short
   descriptions plus House style where the UI permits, and allow a custom
   reference via free text. Skip this question if a style was already supplied.
   No additional tool call or research is needed to select this menu.
   For music, separate role (`music`: bed/score/none) from selection
   (`musicSelection`: choose/soundtrack/tracks). Collect soundtrack names,
   artists, tracks, links, paths and cue preferences in `musicReference` only
   when missing. No music skips these follow-ups; existing preferences and
   explicit delegation skip redundant questions. Carry them through
   `brief.music.brief` into the music plan; research after the interview.
   Map labels to values, multi-selects to arrays, and preserve supplied text verbatim.
   Refresh the queue only when exhausted or when an earlier answer changes and
   invalidates dependent choices. Ask newly applicable questions one at a time.
   Review all answers together after collection, then resolve material contradictions.
   Explicit "you decide" delegates choices; state assumptions in the plan. Pending
   questions, defaults and timeouts are not answers. `interview_next` is a fallback
   for clients that cannot cache questions. Show all questions only on request.
3. When `interview_batch` returns `done`, create the project at the requested frame
   if needed, then `set_brief`. Read `get_playbook preproduction` and `get_style`
   for the chosen style. Author the beats, script, shots, source list and sound plan.
   For a researched director reference, carry its craft record into
   plan.styleTreatment (reference, mechanism, materialPlan, rhythm, sound,
   typography, exceptions, evaluation). Creative defaults guide review;
   source integrity and technical checks remain requirements.
4. `set_plan` → `check_plan` → fix errors → `plan_document`. Show the complete
   proposed document, including any paid generation, and obtain approval for that
   specific plan. Call `approve_plan` only when the user has approved it. Existing
   approval in this conversation counts; do not request it again. This film-plan
   approval applies to editing a composition, not to routine repository changes.
5. `plan_tasks` describes dependencies. Source/import permitted media, generate
   approved AI shots/narration where configured, and assemble. Codex can do these
   tasks itself; `.claude/agents` are optional Claude definitions, not a dependency.
   Use subagents only when allowed by the host and task instructions. Concurrent
   scouts may inspect/source independently; keep timeline mutations coordinated.
6. Follow the edit/verification loop below and show the draft for feedback. Report
   the actual render path and verification results. Do not claim to have listened
   to audio or inspected frames unless you did; mechanical checks have limits.

For a targeted edit to an existing project, use its saved brief/plan and request;
do not restart the full interview. Create a checkpoint before changing the cut.
Use the Agent panel in the editor to follow activity tagged `Codex`.

Design the film's title separately from supporting typography. Read
`guide/playbooks/typography-and-motion.md` after collecting the interview. In the
plan, specify the title's words, font, palette, composition, timing and reveal,
then the supporting text system. `role: title` is the clip/film name; statements,
chapters and CTAs use their supporting roles even when large. A title may have
its own display font; give it prominence through scale, space and timing while
respecting restrained styles. Do not add a film title to a scene by default.

When editing video through the tools:
1. Follow `guide/RULES.md` (also embedded in the server's instructions).
2. Read the playbook for the job first: `get_playbook` — interview-cleanup, scene-highlight,
   vertical-repurpose, music-montage, assembly-from-transcript, delivery-verify.
3. Perceive before cutting: `get_contact_sheet`, `detect_scenes`, `detect_silences`, `transcribe`.
4. `create_checkpoint`, cut with `apply_edit_list`, `render_draft`, then verify with
   `check_cuts`, `pacing_report`, `verify_export`, `get_frame`. Only then `render_final`.
5. Report the cut and why, every check's result, the change list, and what you could not do.

For still-image motion, use the native motion presets or transform keyframes;
the renderer interpolates between pixels to avoid stepped pans and zooms. Keep
movement restrained, retain source resolution, and check a rendered moving
excerpt at the delivery frame rate. A contact sheet cannot verify smoothness.
The user prefers smooth image movement; use static holds when motion adds little.

When working on the code: see `docs/DEPENDENCIES.md`, `docs/AGENT-API.md`, `CLAUDE.md`.
Tests: `corepack pnpm test:windows`, `corepack pnpm test:mcp`,
`corepack pnpm test:eval`, `corepack pnpm test:e2e`. On Windows use native Node
launchers; do not set a global Bash script-shell. Never push to the upstream
`slopstudio-pro` repository; this fork's remote is `SlopStudio-Omarchy`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
