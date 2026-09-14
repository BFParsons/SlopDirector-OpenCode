# SlopStudio on Windows with Codex

SlopStudio uses **Electron**, Next.js and FFmpeg. The Windows desktop runs
natively, with an embedded SQLite database and the same interview → plan → edit
→ verify workflow as the Claude harness. WSL, PostgreSQL and Git Bash are not
required for the desktop target.

**Using Claude Code instead?** Everything below applies unchanged except the
`corepack pnpm codex:setup` step and the *Connect Codex* section — `.mcp.json` already
registers the server for Claude Code. See [`CLAUDE.md`](../CLAUDE.md).

## Setup from PowerShell

Install Node 24 LTS, Git and a full FFmpeg Windows build (both `ffmpeg.exe` and
`ffprobe.exe` on PATH). Open a terminal in this repository:

```powershell
corepack pnpm install --frozen-lockfile
node node_modules/electron/install.js
corepack pnpm codex:setup
corepack pnpm doctor
corepack pnpm desktop:prod
```

`desktop:prod` builds the standalone server on the first launch and after source
changes, then opens Electron. Subsequent launches reuse the build. For active
development, use `corepack pnpm desktop:dev`. Both bind to **127.0.0.1:38473**, the
MCP default. `scripts/launch-desktop.ps1` is a path-independent PowerShell launcher
with `-Dev`, `-Prod` (default), and `-Headless` switches.

Source launches keep the database, assets and generated session secret under
`.data/`. They load `.env` without evaluating it as shell code; existing environment
variables take priority. `DATABASE_URL`, `ASSET_ROOT`, `AUTH_SECRET`,
`SLOPSTUDIO_PYTHON` and FFmpeg overrides are respected. A local desktop `.env` must
use SQLite (`SLOPSTUDIO_DB=sqlite`, `DATABASE_URL=file:C:/path/to/slopstudio.db`).
Existing web/PostgreSQL configurations should continue using `corepack pnpm dev`.

Run only one source desktop/headless server per port and database. A busy port
produces an error; the launcher never kills an unrelated process. To change ports:

```powershell
$env:SLOPSTUDIO_PORT = '4100'
corepack pnpm codex:setup --url http://127.0.0.1:4100
corepack pnpm desktop:prod
```

For an editor in the browser without Electron:

```powershell
corepack pnpm serve:headless
# Open http://127.0.0.1:38473/start
```

## Connect Codex

Open this repository as the project in Codex and trust it. `codex:setup` generates
an ignored **`.codex/config.toml`** containing the absolute Node executable and
`mcp/run.cjs` paths, the server URL, a 600-second tool timeout, and the agent label
`Codex`. Run setup again after moving the checkout. It preserves unrelated config
and refuses to overwrite a manually configured `slopstudio` entry.

Restart the MCP connection (or start a new Codex session) after setup. The editor
must be running before you use its tools. Ask Codex:

> Use SlopStudio to list my projects and confirm the editing tools are connected.

Project MCP configuration is loaded only for trusted projects. Codex's desktop
app and CLI share MCP configuration; see the [official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).
To register it outside this project instead, run this from the repository:

```powershell
$nodeExe = (Get-Command node).Source
$mcpEntry = Join-Path (Get-Location) 'mcp\run.cjs'
codex mcp add slopstudio --env SLOPSTUDIO_URL=http://127.0.0.1:38473 --env SLOPSTUDIO_AGENT_NAME=Codex -- $nodeExe $mcpEntry
```

For that global entry, set `tool_timeout_sec = 600` under
`[mcp_servers.slopstudio]` in the user config as well. The native entry runs without
shell shims and resolves the guide and TypeScript aliases from the checkout even
when Codex starts it from another folder. It does not start a second editor server.
For a remote multi-user server, supply `SLOPSTUDIO_API_TOKEN` in the MCP environment;
do not commit credentials. The local desktop does not need a token.

## Make a composition

Keep SlopStudio open next to Codex. For example:

> Use SlopStudio to make a 60-second landscape documentary from my local footage.
> Interview me first, propose the composition, and edit it after I approve the plan.

Codex follows `AGENTS.md` and the MCP tool guidance:

1. It fetches the interview questions once, then asks one short question at a
   time, multiple choice where possible. Between answers it records your choice
   and moves on, saving research and detailed reasoning for after the interview.
   It reuses information you already supplied, including scripts and shot lists.
   A second fetch checks for any remaining conditional questions before planning.
   You can say "you decide" for open choices or request the whole questionnaire.
2. It saves a brief, proposes the timed beats, script, shots and sound plan, checks
   the plan and shows the complete document. Your approval starts the editing work.
3. It imports/sources media, inspects frames and sound, checkpoints the project,
   builds the timeline and renders a draft. The editor updates as it works.
4. It checks cuts, pacing, mix and export, incorporates your feedback, and renders
   the finished file. Open **Panel → Viewer → Agent** to follow activity labeled Codex.

The workflow does not depend on Claude subagents or on the host exposing MCP
prompts. Codex can call `interview_batch` and the other tools directly. Its question
UI may differ from Claude's; a pending/default choice is never treated as an answer.
Edits to an existing film use its saved brief and your instructions rather than
repeating the full interview.

## Audio analysis and optional generation

For local Whisper transcription, librosa beat detection and Demucs stem separation,
install Python 3.13, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-audio.ps1
corepack pnpm doctor
```

This installs a CPU baseline into the ignored `.venv` folder. The native launchers
discover it automatically; restart the app afterward. For a separate CUDA setup,
set `SLOPSTUDIO_PYTHON` to that environment's `python.exe`. Model weights download
on first use. The Python environment is not bundled into the installer.

YouTube sourcing additionally needs `yt-dlp` and Deno on PATH. Existing AI video
and voice generation still use the app's OpenRouter integration; configure its key
in the app or `.env` if you want those features. A Codex subscription does not
configure or pay for those generators. Local media editing needs no generation key.

## Build a Windows installer

Build on Windows x64 so Prisma and native dependencies match the target:

```powershell
corepack pnpm desktop:build:win
```

This builds the SQLite standalone server, fetches Windows FFmpeg/FFprobe from
BtbN into `vendor/ffmpeg`, and produces an NSIS installer in `dist/`. It installs
per user and preserves app data on uninstall. The build is unsigned; signing and
public distribution are separate release steps. Linux AppImage builds remain
available through `desktop:build` on Linux.

Installed copies store their database/assets in Electron's Windows user-data
folder, separate from the source checkout's `.data`. Close the source app before
using an installed copy on the same MCP port. Keep this checkout for the MCP server.
To use the checkout's audio tools in an installed copy, set `SLOPSTUDIO_PYTHON`
to the absolute `.venv\Scripts\python.exe` path before launching it. Source
launchers set this automatically.

## Verification

```powershell
corepack pnpm test:platform
corepack pnpm test:mcp
corepack pnpm test:eval
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

`test:platform` runs every suite in `tests/platform`; the individual ones are
`test:windows`, `test:motion`, `test:interview`, `test:director-style`,
`test:typography`, `test:source-music` and `test:trailer`.

Tests import the Prisma client; the launchers generate it, so run
`corepack pnpm db:sqlite:generate` first in a checkout you have not launched yet.

The running server is required for MCP/eval checks; Playwright can start a local
dev server or reuse the production server. Tests create and remove their own
projects. The platform checks render through paths with spaces, apostrophes and
punctuation, and start the actual MCP entry from another working directory.
MCP acceptance includes beat detection, which requires the Python environment.

After building the installer, `node tests/platform/desktop-smoke.cjs` opens the
packaged Electron app with an isolated database and runs the MCP acceptance suite
against its bundled server and FFmpeg. Set `SLOPSTUDIO_TEST_EXE` to test another
installed/extracted copy of `SlopStudio Pro.exe`.
