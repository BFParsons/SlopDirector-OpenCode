# SlopStudio MCP server

Lets Claude Code, Claude Desktop, Codex — any MCP client — edit video in a
running SlopStudio through its HTTP API. One process, stdio transport, no
extra services: the app (desktop or `pnpm serve:headless`) is the source of
truth and the open editor live-updates while the agent works.

## Start SlopStudio, then add the server

```bash
# the app must be running: the app-menu entry, scripts/launch-desktop.sh --prod,
# or, with no display:
pnpm serve:headless
```

**Claude Code** (this repo already ships `.mcp.json`, so inside the repo the
server is offered automatically; from anywhere else):

```bash
claude mcp add slopstudio -e SLOPSTUDIO_URL=http://127.0.0.1:38473 -- \
  /path/to/SlopStudio-Omarchy/node_modules/.bin/tsx /path/to/SlopStudio-Omarchy/mcp/server.ts
```

**Claude Desktop** — `claude_desktop_config.json`:

```json
{ "mcpServers": { "slopstudio": {
  "command": "/path/to/SlopStudio-Omarchy/node_modules/.bin/tsx",
  "args": ["/path/to/SlopStudio-Omarchy/mcp/server.ts"],
  "env": { "SLOPSTUDIO_URL": "http://127.0.0.1:38473" } } } }
```

**Codex** — `~/.codex/config.toml`:

```toml
[mcp_servers.slopstudio]
command = "/path/to/SlopStudio-Omarchy/node_modules/.bin/tsx"
args = ["/path/to/SlopStudio-Omarchy/mcp/server.ts"]
env = { SLOPSTUDIO_URL = "http://127.0.0.1:38473" }
```

Against a multi-user server (desktop auth off) add `SLOPSTUDIO_API_TOKEN` to
`env`; see `docs/AGENT-API.md`.

## Watching it work

Open the project in the app and watch the editor: clips the agent adds fade in one by one, the clip it just touched is selected with the playhead on it, and a fresh draft takes over the monitor (the *follow* toggle). For the log itself add the **Agent** panel (Panel → Viewer → Agent, or click the toolbar pill): every tool call — arguments, result, the contact sheets it looked at. `pnpm exec tsx scripts/ghost-demo.ts <projectId>` replays a real clear-and-rebuild of the cut so you can see it. `SLOPSTUDIO_AGENT_FEED=0` in this server's environment turns the reporting off. To see the panel without running a job: `pnpm exec tsx scripts/agent-lane-demo.ts <projectId>` replays a short scripted session into it (`--screenshot out.png` captures the editor headlessly).

## Tools

Pre-production first for a new piece: the `interview` prompt drives `interview_next` one multiple-choice question at a time (AskUserQuestion in Claude Code) into `set_brief`, `set_plan` / `check_plan` / `plan_document` / `approve_plan` / `plan_tasks`, then sourcing in parallel (`search_youtube`, `source_clips`, `add_ai_shot` / `generate_ai_shots`, `generate_narration`, `list_video_models`) and `storyboard_sheet` to review a cut. Sub-agent definitions for Claude Code live in `.claude/agents/` (clip-scout, narrator, shot-picker).

| Group | Tools |
|---|---|
| Project | `list_projects`, `create_project` (frame presets: 1080p, 4k, 720p, vertical, square, 4:5, preview), `get_project`, `update_project`, `delete_project` |
| Media | `import_media` (local file), `import_youtube`, `list_media`, `probe_asset`, `set_music`, `set_lut` |
| Inspect | `get_frame` (image), `get_contact_sheet` (image + times), `detect_scenes`, `detect_silences`, `transcribe` (word timings) |
| Timeline | `add_segment`, `update_segments`, `split_segment`, `reorder_segments`, `delete_segment`, `add_text_overlay`, `remove_text_overlay`, `create_checkpoint`, `list_checkpoints`, `restore_checkpoint`, `apply_edit_list` (checkpointed batch with rollback) |
| Render | `render_draft` (≤640×360, seconds), `render_final`, `render_status`, `cancel_render`, `export_formats` |
| Checks | `check_soundtrack` (the audio map and its clashes), `check_mix_levels` + `balance_music` (voice vs music in LUFS), `pacing_report`, `check_cuts`, `check_beat_alignment`, `verify_export`, `compare_versions`, `analyze_audio` — the guide's mechanical checks |
| Guide | `search_guide`, `read_guide`, `list_guide`, `get_playbook` — the editing guide and playbooks (`guide/`) |

Resources: `slopstudio://projects[/{id}]`, `slopstudio://guide[/{section}]`, `slopstudio://playbooks/{name}`.
Prompts: `edit_video`, `playbook` (a job's procedure + the always-on rules). The server's
instructions carry `guide/RULES.md`, so every client sees the rules without asking.

## Try it

```bash
pnpm test:mcp        # drives the server through the MCP client SDK against the running app:
                     # lists tools, cuts silences, builds a scene highlight, checkpoints, drafts
pnpm exec tsx tests/bench/job.ts <label>     # times a whole job (perceive → cut → checks → draft → final);
                                             # BENCH_COMPARE=<label> prints speedups, BENCH_IMPORT=1 adds a YouTube import
pnpm exec tsx tests/bench/calls.ts 'get_project {"projectId":"…"}' …   # times single tools over one connection
```

The eval tasks in `tests/eval/` are the scoring harness; `tests/mcp/run.ts`
solves the same tasks through the MCP tools, which is the acceptance test for
this layer.

## What the server knows

The tools are grouped project · media · inspect · timeline · render · verify ·
pre-production · sourcing · typography · guide (68 tools, 4 prompts —
[`guide/appendix-a-tools.md`](../guide/appendix-a-tools.md) is generated from the
server with `pnpm exec tsx scripts/gen-tool-reference.ts`). The craft the tools
enforce is the editing guide ([`guide/`](../guide/): `read_guide`, `search_guide`,
`get_playbook`), the directing styles ([`guide/styles/`](../guide/styles/README.md):
`list_styles`, `get_style`) and the typography on safe areas (`list_typography`,
`check_text`). `pnpm test:mcp` runs the acceptance suite against the running app.

