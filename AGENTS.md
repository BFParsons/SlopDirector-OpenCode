# SlopStudio — notes for Codex and other agents

SlopStudio is a video editor with an MCP server (`pnpm mcp`; configured in
`~/.codex/config.toml` as `slopstudio`). The app must be running (desktop app or
`pnpm serve:headless`).

When editing video through the tools:
1. Follow `guide/RULES.md` (also embedded in the server's instructions).
2. Read the playbook for the job first: `get_playbook` — interview-cleanup, scene-highlight,
   vertical-repurpose, music-montage, assembly-from-transcript, delivery-verify.
3. Perceive before cutting: `get_contact_sheet`, `detect_scenes`, `detect_silences`, `transcribe`.
4. `create_checkpoint`, cut with `apply_edit_list`, `render_draft`, then verify with
   `check_cuts`, `pacing_report`, `verify_export`, `get_frame`. Only then `render_final`.
5. Report the cut and why, every check's result, the change list, and what you could not do.

When working on the code: see `docs/DEPENDENCIES.md`, `docs/AGENT-API.md`, `CLAUDE.md`.
Tests: `pnpm test:e2e`, `pnpm test:eval`, `pnpm test:mcp`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
