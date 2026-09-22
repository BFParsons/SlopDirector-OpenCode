# SlopStudio on macOS with OpenCode

SlopStudio uses **Electron**, Next.js and FFmpeg. On a Mac the desktop app runs natively
(Apple Silicon or Intel), with an embedded SQLite database and the same interview → plan →
edit → verify workflow as the Claude Code and Codex harnesses. Nothing here needs Docker,
PostgreSQL or a global pnpm.

**Using Claude Code or Codex instead?** Everything below applies unchanged except the
*Connect OpenCode* section — `.mcp.json` registers the server for Claude Code
([`CLAUDE.md`](../CLAUDE.md)) and `corepack pnpm codex:setup` does it for Codex
([`AGENTS.md`](../AGENTS.md)).

## Setup from Terminal

Install the tools with Homebrew, then enable corepack so `corepack pnpm` picks up the
pinned pnpm from `package.json`:

```sh
brew install node@24 yt-dlp git
brew link --overwrite node@24        # or use mise / nvm; Node 22–24 are accepted, 26 is not
corepack enable
```

Node 24 is what `mise.toml` pins and what Electron embeds; the launcher's `doctor` accepts
Node 22 through 25. **Not Node 26** — Electron's postinstall silently fails to unpack the
binary there. If you use [mise](https://mise.jdx.dev), `mise install` in the checkout does
the Node + pnpm part for you.

Clone, fetch ffmpeg, install:

```sh
git clone https://github.com/BFParsons/SlopDirector-OpenCode.git
cd SlopDirector-OpenCode
bash scripts/fetch-ffmpeg.sh
corepack pnpm install --frozen-lockfile
corepack pnpm doctor
corepack pnpm desktop:prod
```

`desktop:prod` builds the standalone server on the first launch and after source changes,
then opens the Electron window. Subsequent launches reuse the build. For active development
use `corepack pnpm desktop:dev`; for no window at all, `corepack pnpm serve:headless` and
open `http://127.0.0.1:38473/start`. All three bind **127.0.0.1:38473**, the MCP default.

**Why not `brew install ffmpeg`?** Homebrew's formula (9.0.x as of Sep 2026) is built without
libfreetype, fontconfig, harfbuzz and libass, so its ffmpeg has **no `drawtext` and no `ass`
filter** — every title card and burned-in caption fails with `No such filter: 'drawtext'`.
`scripts/fetch-ffmpeg.sh` downloads a full static build (ffmpeg.martin-riedl.de, arm64 or
Intel, includes both) into `vendor/ffmpeg/`, and the app prefers that directory over PATH
whenever both binaries are present — no env var needed. To use another ffmpeg, set
`SLOPSTUDIO_FFMPEG_DIR` in `.env`; `doctor` checks that whichever one wins has both filters.

`doctor` checks Node, ffmpeg/ffprobe and their filters, yt-dlp, the Electron binary and the
generated Prisma client. If it complains about Electron, run `node node_modules/electron/install.js` once —
the download is large and Homebrew-network flakiness sometimes truncates it.

### Optional: the Audio Studio (Demucs stems + Whisper captions)

The stem-separation and transcription features need a Python 3.12 environment with
`demucs`, `openai-whisper` and `torchcodec`. A `.venv` in the checkout is picked up
automatically (`scripts/local-runtime.mjs`); otherwise point `SLOPSTUDIO_PYTHON` at the
interpreter in `.env`:

```sh
brew install python@3.12
python3.12 -m venv .venv
.venv/bin/pip install demucs openai-whisper torchcodec librosa
```

Apple Silicon runs PyTorch on the CPU or MPS backend; there is no CUDA. Expect Demucs to be
slower than on an NVIDIA box. Full detail: [`AUDIO_STUDIO.md`](AUDIO_STUDIO.md) and the
Python section of [`DEPENDENCIES.md`](DEPENDENCIES.md).

### Environment

Copy [`.env.example`](../.env.example) to `.env` and fill in only what you use. The
desktop launcher generates `AUTH_SECRET`, the database and the asset folder itself. The
two keys that matter for the harness are `ELEVENLABS_API_KEY` (the house narrator) and
`OPENROUTER_API_KEY` (AI video, LLM helpers, fallback TTS). Both are optional; without them
narration and AI shots are unavailable and everything else works. **Never commit `.env`.**

Age- or region-gated YouTube imports can read cookies from a browser profile:
`YTDLP_COOKIES_FROM_BROWSER=safari` (or `chrome`, `firefox`). Safari needs Full Disk Access
for Terminal; Chrome works without it.

## Connect OpenCode

Install OpenCode (`brew install sst/tap/opencode` or `npm i -g opencode-ai`), start the
app as above, then run `opencode` **in this repository**. There is no setup step:

- [`opencode.json`](../opencode.json) registers the `slopstudio` MCP server (`node
  mcp/run.cjs` against `http://127.0.0.1:38473`, labelled `OpenCode` in the editor's Agent
  panel) and loads [`HARNESS-LOOP.md`](HARNESS-LOOP.md) as instructions alongside
  [`AGENTS.md`](../AGENTS.md), which OpenCode reads automatically.
- [`.opencode/commands/`](../.opencode/commands/) provides `/interview`, `/preproduction`,
  `/edit-video` and `/playbook` — the same entry points Claude Code gets as MCP prompts.
- [`.opencode/agents/`](../.opencode/agents/) provides the `clip-scout`, `narrator` and
  `shot-picker` subagents for the fan-out after plan approval, each restricted to the
  `slopstudio_*` tools its job needs.

Ask OpenCode to `list_projects`; if it answers with the project list the connection works.
If the tools are missing, check that the app is running on 38473 and that the MCP server
shows as connected in OpenCode's status; a `node` on PATH that is Node 26 or older than 22
is the usual cause of a server that will not start.

OpenCode's `question` tool is what the interview uses for one-question-at-a-time multiple
choice; the harness brief in `AGENTS.md` explains the conventions (recommended option
first, no "Other", map labels back to option values).

Tool calls such as `render_final` or `import_youtube` can take minutes. OpenCode's
`timeout` in `opencode.json` is the server start-up timeout (60 s), not a per-call limit;
long tool calls are fine.

## Packaging a .app

```sh
corepack pnpm desktop:build:mac
```

This builds the standalone server, fetches static `ffmpeg`/`ffprobe` for your
architecture into `vendor/ffmpeg/` (`scripts/fetch-ffmpeg.sh`, from
ffmpeg.martin-riedl.de) and runs electron-builder for a DMG into `dist/`. The app is
unsigned (`identity: null`): on first open, right-click → Open, or run
`xattr -dr com.apple.quarantine "dist/mac*/SlopStudio Pro.app"`. Sign and notarize with
your own Developer ID by setting `CSC_LINK`/`CSC_KEY_PASSWORD` and removing the `identity`
override in `package.json`.

A packaged app started from Finder inherits a minimal PATH; `electron/main.js` adds
`/opt/homebrew/bin` and `/usr/local/bin` so Homebrew `yt-dlp` still resolves (the bundled
ffmpeg is used regardless).

## What is different on a Mac

- **Hardware encoding.** The renderer knows NVENC, QSV and VAAPI; there is no VideoToolbox
  backend yet, so `VIDEO_ENCODER=auto` falls back to software `libx264`/`libx265`. Renders
  are correct, just slower than on a GPU box. Adding `h264_videotoolbox` to
  `src/lib/ffmpeg/encoder.ts` and `src/lib/system/capabilities.ts` is the obvious next
  improvement.
- **Closing the window does not quit.** As is idiomatic on macOS, the app stays in the Dock
  and re-activating it reopens the window against the same embedded server.
- **Line endings.** `.gitattributes` keeps every script LF on checkout so shebangs work;
  only the `.ps1` files stay CRLF.
- **Windows-only pieces** (`scripts/*.ps1`, `desktop:build:win`, `tests/platform/windows.test.ts`)
  are inert here; `test:platform` still runs them and they pass on any OS.

## Verifying a change

```sh
corepack pnpm db:sqlite:generate                    # once, in a checkout that has never launched
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm test:platform
corepack pnpm test:mcp                              # needs the app running
```
