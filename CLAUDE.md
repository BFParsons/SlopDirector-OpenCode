# SlopStudio — notes for Claude Code

This repo is a video editor (Next.js + Electron desktop shell, ffmpeg engine) with an
MCP server that lets an agent edit video in the running app.

- **Editing through the MCP server** (`.mcp.json` registers it; the app must be running:
  the desktop app or `pnpm serve:headless`): follow `guide/RULES.md` at all times, read the
  matching playbook (`get_playbook`) before a job, and verify with `check_cuts`,
  `pacing_report`, `verify_export` on a `render_draft` before `render_final`. The full
  craft guide is `guide/editing-guide.md` (`search_guide`, `read_guide`).
- **A new piece starts with pre-production**: the `interview` prompt (one round of
  questions: standalone or a scene, scripted + genre, sources, premise, tone, narration /
  music / text) → `set_brief` → the `preproduction` prompt / playbook → `set_plan` →
  `check_plan` clean → `plan_document` to the person → their yes → `approve_plan` →
  `plan_tasks` and fan out the independent tasks in parallel (sub-agents in
  `.claude/agents/`: clip-scout, narrator, shot-picker; or `source_clips`,
  `generate_ai_shots`, `generate_narration`). Nothing is sourced or cut before approval.
- **Working on the code**: `docs/DEPENDENCIES.md` (setup, Omarchy notes), `docs/AGENT-API.md`
  (routes), `docs/CHANGELOG.md`. Tests: `pnpm test:e2e` (Playwright, 20), `pnpm test:eval`
  (scored editing tasks), `pnpm test:mcp` (MCP acceptance). Type-check with
  `pnpm exec tsc --noEmit -p tsconfig.json`; lint with `pnpm exec eslint <paths>`.
- Never push to the original `slopstudio-pro` repository; this fork's remote is
  `SlopStudio-Omarchy`.
