# SlopStudio Pro — Dependencies & Setup

**Native Windows desktop and Codex:** use [WINDOWS-CODEX.md](WINDOWS-CODEX.md).
It supersedes the older Windows/WSL guidance below. Desktop/headless launchers
now run through Node, use SQLite, and need no Bash script-shell or PostgreSQL.
`desktop:build:win` builds an NSIS installer with Windows FFmpeg executables.

Everything you need to run, develop, and build SlopStudio Pro — with a dedicated
**[Windows section](#windows-setup)** since dev is moving to a Windows machine.

SlopStudio Pro ships **two targets from one codebase**:

| Target | DB | Auth | Media encode | How it runs |
|---|---|---|---|---|
| **Web** (`pnpm dev`) | PostgreSQL | login | system ffmpeg on PATH | Next.js dev/standalone server |
| **Desktop** (AppImage) | embedded SQLite | none (single user) | **bundled** ffmpeg | Electron spawns the standalone server |

The dependency lists below are split into **always required** and **only required
for the Audio Studio** (the Python/ML stack is heavy and optional — the rest of the
app runs fine without it).

---

## 1. Core toolchain (always required)

| Tool | Version used here | Notes |
|---|---|---|
| **Node.js** | v24 LTS (works on 20–24; **not 26** — see Omarchy section) | pinned in `mise.toml`; same major Electron 44 embeds |
| **pnpm** | 10.33.0 | `packageManager` is pinned in `package.json`; use `corepack enable` to get the exact version |
| **Git** | any | |

```bash
corepack enable          # provides the pinned pnpm
pnpm install             # installs all JS deps
```

JS dependencies of note (full list in `package.json`): **Next.js 16**, **React 19**,
**Prisma 6** (dual client — see below), **PixiJS 8 + pixi-filters** (WebGL preview
compositor), **wavesurfer.js** (audio waveforms), **Zustand 5**, **Tailwind 4**,
**Electron 44 + electron-builder 26** (desktop; Chromium 152, embedded Node 24), **@node-rs/argon2** (password hashing —
a native module).

---

## 2. Database — PostgreSQL (web) + SQLite (desktop)

Prisma generates **one of two clients** to the default `@prisma/client` location:

```bash
pnpm db:generate          # PostgreSQL client  → for `pnpm dev` (web)
pnpm db:sqlite:generate   # SQLite client      → used inside `pnpm desktop:build`
```

> ⚠️ **Switching targets requires re-running the matching generate.** After a
> `desktop:build` the on-disk client is SQLite, so the web dev server breaks until
> you run `pnpm db:generate` again. (The build scripts handle this, but if you build
> the AppImage then try `pnpm dev`, run `db:generate` first.)

### Dev PostgreSQL

- This repo has its **own** database `slopstudio_pro` (not shared with the upstream
  SlopStudio — they collided on the job queue + asset dirs otherwise).
- On Linux, a no-sudo user-owned instance runs on port **5434** via `scripts/pg.sh`
  (`start|stop|status|psql`); `DATABASE_URL` in `.env` points at it.
- Schema sync for a fresh DB: `pnpm exec prisma db push`. Seed an admin with
  `pnpm tsx --env-file=.env scripts/create-admin.ts <email> <password> ADMIN`
  (also doubles as a password reset).

### Desktop SQLite

- The AppImage creates `~/.config/slopstudio-pro/slopstudio.db` on first launch from
  `prisma/desktop-schema.sql` and seeds a local admin. No external DB needed.

---

## 3. ffmpeg + ffprobe (always required for video)

Used for the final render/assembly and probing. Resolution order
(`src/lib/ffmpeg/binary.ts`):

1. `SLOPSTUDIO_FFMPEG_PATH` / `SLOPSTUDIO_FFPROBE_PATH` (explicit absolute paths)
2. `SLOPSTUDIO_FFMPEG_DIR` (a dir holding both) — set by the desktop shell **only if a
   bundled binary exists**
3. the system `ffmpeg` / `ffprobe` on **PATH** ← web/dev path

- **Dev/web:** install ffmpeg and have it on PATH (here: ffmpeg 7.1.4).
- **Desktop AppImage:** a static ffmpeg+ffprobe (**BtbN release-9.0 GPL build**, ffmpeg
  9.0.x) is **bundled** into `resources/ffmpeg`. It's fetched into `vendor/ffmpeg/` at
  build time by `scripts/fetch-ffmpeg.sh` (run automatically by `pnpm desktop:build`).
  The binaries are gitignored (~280 MB). This build has VAAPI/QSV/Vulkan hardware
  encode, libplacebo, libx265, SVT-AV1, libvidstab, librubberband, libass and lut3d —
  see `docs/UPGRADES-2026-09.md` for what that unlocks. (Until 2026-09 this was a
  johnvansickle 7.0.2 build from 2024 with no VAAPI.)
- **Encoder selection** is probed at runtime against the *resolved* ffmpeg
  (`src/lib/system/capabilities.ts`): hardware (NVENC/QSV/VAAPI) if both listed *and*
  validated, else **libx264 software**. The probe must use the same binary the render
  does.

---

### RNNoise models (bundled)

The Processing Rack's *Noise suppression (RNN)* module uses ffmpeg's `arnndn` filter with
the RNNoise models in `public/rnnoise/` (`bd.rnnn` default, `sh.rnnn`), from
https://github.com/GregorR/rnnoise-models — no Python involved. They ship with the
standalone build because they live under `public/`.

## 4. Audio Studio — Python / ML stack (optional, heavy)

The **Audio Studio** workspace adds local audio ML. It degrades gracefully when these
aren't installed (the panels still load; the jobs error with a message). Required only
if you want **stem separation** (Demucs) or **captions/transcription** (Whisper).

Invocation is `python -m demucs.separate` / `python -m whisper` via
`src/lib/audio/binaries.ts`, overridable with env vars (see §6).

### What's needed (exact versions installed here)

| Package | Version here | Purpose |
|---|---|---|
| **Python** | 3.13.5 | interpreter (`python3`) |
| **demucs** | 4.0.1 | stem separation (vocals/drums/bass/other) |
| **torch** | 2.11.0 | demucs/whisper backend (CPU or CUDA) |
| **torchaudio** | 2.11.0 | audio I/O for demucs |
| **🔴 torchcodec** | 0.13.0 | **REQUIRED by torchaudio ≥2.8 to *save* audio** |
| **openai-whisper** | latest | speech-to-text captions |

> 🔴 **The torchcodec gotcha (cost us a real bug).** torchaudio 2.11 routes audio
> *saving* through `torchcodec`. Without it, Demucs computes the stems then crashes on
> write with `ImportError: TorchCodec is required for save_with_torchcodec`. **You must
> install `torchcodec` separately** — `pip install torch torchaudio` does *not* pull it
> in. Install a torchcodec version compatible with your torch.

### Install (Linux, what was done here)

This machine's torch/torchaudio live in the **user site** (PEP 668 externally-managed
Python), so installs use `--break-system-packages`:

```bash
python3 -m pip install --user --break-system-packages \
    demucs openai-whisper torchcodec
# torch + torchaudio come in as demucs deps; torchcodec must be explicit.
```

On a clean machine, prefer a **virtualenv** and point the app at it:

```bash
python3 -m venv ~/.slopstudio-py
~/.slopstudio-py/bin/pip install demucs openai-whisper torchcodec
# then in .env:  SLOPSTUDIO_PYTHON="/home/you/.slopstudio-py/bin/python"
```

### Models (auto-downloaded on first use)

- Demucs `htdemucs` weights (~84 MB) download to `~/.cache/torch/hub/checkpoints/` on
  the first separation. Whisper models download similarly. **First run needs network
  and takes minutes;** later runs are cached. CPU separation of a 4 s clip ≈ 6 s here.

---

## 5. Desktop build (Electron AppImage)

```bash
pnpm desktop:build     # = fetch-ffmpeg → db:sqlite:generate → next build (standalone)
                       #   → postbuild-standalone → electron-builder --linux AppImage
pnpm db:generate       # IMPORTANT: restore the Postgres client afterwards for web dev
```

- Output: `dist/SlopStudio Pro-<ver>.AppImage` (~360 MB, gitignored).
- Run it (Linux, /tmp is noexec here):
  `DISPLAY=:0 TMPDIR=~/.cache/appimg "./dist/SlopStudio Pro-0.1.0.AppImage" --appimage-extract-and-run`
- `electron-builder` is currently configured for **`--linux AppImage` only**.

---

## 6. Environment variables (`.env`)

| Var | Used by | Default / notes |
|---|---|---|
| `DATABASE_URL` | Prisma | dev: `postgresql://…@localhost:5434/slopstudio_pro` |
| `WORKER_ENABLED` | job worker | `"true"` to run the render worker in-process (dev + desktop) |
| `OPENROUTER_API_KEY` | AI generation | only for the LLM/video/TTS pipeline |
| `ELEVENLABS_API_KEY` | narration | when set, ElevenLabs becomes the default narrator for the Voiceover panel, the TTS job and MCP `generate_narration` (`src/lib/tts/synthesize.ts`) |
| `ELEVENLABS_VOICE_ID` | narration | the house voice id (default: the catalogue's "British Guy Documentary", `mliUAyOykvIlRkwruosy`) |
| `ELEVENLABS_MODEL_ID` / `_STYLE_TAG` | narration | `eleven_v3`; the v3 audio tag prepended to each take (`[serious]`; `""` disables) |
| `ELEVENLABS_STABILITY` / `_SIMILARITY` / `_SPEED` | narration | voice settings, default 0.5 / 0.8 / 1 |
| `ELEVENLABS_CONDITION` | narration | ffmpeg filters applied to each take → 48 kHz mono WAV (default `highpass=f=65,loudnorm=I=-16:TP=-2:LRA=7`) |
| `SLOPSTUDIO_TTS_MODEL` / `_VOICE` | narration | pin the default explicitly to a catalogue model id and one of its voices |
| `NEXT_PUBLIC_DEFAULT_TTS_MODEL` | UI | build-time default for the model pickers when creating a project |
| `SLOPSTUDIO_FFMPEG_PATH` / `_DIR` | ffmpeg resolver | override the binary; else PATH |
| `SLOPSTUDIO_PYTHON` | Audio Studio | path to the Python interpreter (default `python3`) |
| `SLOPSTUDIO_DEMUCS_ARGV` | Audio Studio | JSON array overriding the demucs argv prefix |
| `SLOPSTUDIO_WHISPER_ARGV` | Audio Studio | JSON array overriding the whisper argv prefix |
| `VIDEO_ENCODER` | render | `auto` (default) / `x264` / `vaapi` / `nvenc` / `qsv` |
| `ASSET_ROOT` | storage | dev: `./.data/assets` |
| `AUTH_SECRET` | sessions | per-install (desktop generates one) |

---

## Omarchy / Arch Linux setup (desktop-target dev, no Postgres)

Dev moved to an **Omarchy** laptop (Arch Linux + Hyprland, Intel iGPU) in 2026-09.
What differs from the Debian/Windows notes above:

- **Toolchain via mise.** `mise.toml` pins **Node 24** + pnpm 10.33.0 and mise
  activates them on `cd` (on a fresh clone: `mise trust && mise install`). Do **not**
  use Node ≥ 26: Electron's postinstall (extract-zip/yauzl) silently fails to unpack
  the binary, `node_modules/electron/dist` ends up holding only `locales/`, and launch
  dies with *"Electron failed to install correctly"*. Fix: switch to 22, then
  `pnpm rebuild electron`.
- **No Postgres needed.** `.env` runs the **desktop target in dev**:
  `SLOPSTUDIO_DB=sqlite`, `DATABASE_URL=file:<repo>/.data/slopstudio.db`,
  `SLOPSTUDIO_DESKTOP=1` (single local user, no login screen), `WORKER_ENABLED=true`.
  First boot creates the schema from `prisma/desktop-schema.sql` and seeds
  `admin@slopstudio.local` / `slopstudio`. The `.env` only works with the SQLite client:
  run `pnpm db:sqlite:generate` after `pnpm install`. The `prisma:error … duplicate
  column name` lines on every boot are the forward migrations in
  `src/lib/db/bootstrap.ts` probing columns that already exist — harmless.
- **Postgres (web target) still works** if you want it: `sudo pacman -S postgresql`,
  then `scripts/pg.sh init` (auto-detects Arch's `/usr/bin`; creates the `spotforge`
  role + `slopstudio_pro` DB on :5434), point `DATABASE_URL` at
  `postgresql://spotforge:spotforge_dev@localhost:5434/slopstudio_pro`, unset
  `SLOPSTUDIO_DB`, and `pnpm db:generate && pnpm exec prisma db push`.
- **ffmpeg** — Arch's `ffmpeg` 9.x with **VAAPI + QSV** (`intel-media-driver`); the
  capability probe validates and picks VAAPI (`[worker] … encode VAAPI (GPU)`).
- **yt-dlp + Deno** — pacman packages, on PATH.
- **Audio Studio** — Python 3.14 venv at `~/.slopstudio-py` using the **CPU** wheel
  index (`pip install torch torchaudio torchcodec --index-url
  https://download.pytorch.org/whl/cpu`, then `pip install demucs openai-whisper`);
  ~2.2 GB. Wired via `SLOPSTUDIO_PYTHON` in `.env`. Verified: torch 2.14 / torchaudio
  2.11 / torchcodec 0.16 / demucs 4.1 / openai-whisper.
- **Launcher** — `scripts/launch-desktop.sh` (Linux port of `launch-desktop.ps1`)
  activates mise and runs the app. **`--prod`** (what the app-menu entry uses) builds
  the standalone production bundle when sources changed and has Electron spawn it —
  precompiled routes, React production mode, no HMR: much faster and lighter than the
  dev loop. Without the flag it clears a stale :3000 server and runs `pnpm desktop:dev`.
  Both use the same `.env` (DB, assets, keys).
  `~/.local/share/applications/slopstudio-pro.desktop` puts **SlopStudio Pro** in the
  Omarchy app menu. Electron opens a native Wayland window
  (`ELECTRON_OZONE_PLATFORM_HINT=wayland` is set by Omarchy's Hyprland env).
- **Startup + render latency (2026-09).** The first page no longer waits for the
  worker's ffmpeg/GPU probe: it runs in the background and its result is cached in
  `capabilities-cache.json` next to the SQLite DB (keyed on the ffmpeg build + render node,
  one-week TTL). `SLOPSTUDIO_CACHE_DIR=<dir>` relocates it, `SLOPSTUDIO_CAPS_CACHE=false`
  disables it (the probe then runs on every launch, ~4 s). Electron shows a splash while
  the server boots. Jobs enqueued from the app wake the in-process worker immediately
  instead of waiting for the next `WORKER_POLL_MS` tick. Measured cold start on the UHD 620
  laptop: window at 2.4 s, usable page at 4.9 s (was 3.3 s / 8.5 s).
- **VA-API decode for exports** (`HW_DECODE=auto|on|off`, default auto). At startup the
  probe does a real test decode of H.264, HEVC and HEVC Main10 samples with
  `-hwaccel_output_format vaapi`. During export a 4:2:0 source clip is decoded on the GPU
  when (a) its codec/bit-depth validated, (b) it is 10-bit HEVC **or** has at least 1.5×
  the export frame's pixels, and (c) it carries no source-stage effect (deinterlace /
  stabilize / HDR tone-map). The frames are downscaled on the GPU (`scale_vaapi`) *before*
  being downloaded, then the normal CPU filter graph runs. Why so narrow: on this iGPU the
  GPU decodes 8-bit 4K HEVC 3.5× faster than the CPU, but downloading full-size 4K frames
  costs as much as the decode saved, and at 1080p the round-trip is a net loss — the gain
  needs the GPU to shrink the frames first (4K → 1080p export: 4.5 s vs 8.4 s for a 6 s
  clip). 10-bit is different: the CPU decodes an 80 Mbps 4K Main10 clip at ~10 fps, so the
  GPU wins even at full size (4 s clip, 4K → 4K: 10.1 s vs 15.6 s; 4K → 1080p: 3.9 s vs
  13.5 s). Cached in `capabilities-cache.json` as `hwDecode: ["h264","hevc","hevc10"]`.
- **Concurrency knobs for agent fan-out (2026-09).** `YT_IMPORT_CONCURRENCY` (default 3):
  YouTube imports used to run one at a time because yt-dlp rewrote a shared cookies jar;
  each run now gets its own copy of the jar (`lib/youtube/import.ts`) and copies it back.
  `WHISPER_CONCURRENCY` (default 2): at most this many Whisper runs at once, the rest queue,
  and concurrent requests for the same file + model share one run — nine scouts asking for
  transcripts together put eleven whisper processes on the laptop (load average 67).
- **Open on a project:** `SLOPSTUDIO_OPEN=/projects/<id> scripts/launch-desktop.sh --prod` starts
  the desktop window on that page (same-origin paths only).
- **Agent panel (2026-09).** The MCP server reports every tool call to the app so the open
  editor can show what the agent is doing (Studio → Panel → Agent; also in the rendering
  view). `SLOPSTUDIO_AGENT_FEED=0` in the MCP server's environment turns the reports off,
  `SLOPSTUDIO_AGENT_NAME=<label>` names the agent in the feed. The panel's own toggle
  (off / changes / everything, follow) is saved in the browser's localStorage.
- **Analysis cache (2026-09, speed loops).** Scene cuts, silences, loudness, black/frozen
  frames, loudness timelines, Whisper transcripts and the 16 kHz wav they read are cached
  under `<ASSET_ROOT>/_cache/<fingerprint>/` (fingerprint = sha1 of the file, memoized per
  path/size/mtime), so the same media reused in another project — the segments API *copies* a
  foreign asset into the project — is warm from the first call. Safe to delete; rebuilt on
  demand. Per-project `cache/` dirs still hold frames and contact sheets. ffprobe results
  are memoized in-process by path+size+mtime (`lib/ffmpeg/probe.ts`). Exports encode AAC
  with `-aac_coder fast` (ffmpeg's recommendation above 128 kb/s; 2× faster than the
  default coder on this CPU). `tests/bench/job.ts` measures a whole harness job; see
  CHANGELOG "Speed loops" for the numbers.
- **`.npmrc`** — the Windows-only `script-shell=C:\PROGRA~1\Git\bin\bash.exe` line was
  removed from the repo (it made every `pnpm <script>` fail on Linux with ENOENT).
  Windows devs set it in their **user** `%USERPROFILE%\.npmrc` instead — see Option B.

---

## 6b. Headless server, API token, eval harness

`pnpm serve:headless` (`scripts/serve-headless.sh`) runs the production bundle without
Electron on `:38473` (same `.env`, SQLite, in-process worker; `--dev` for `next dev`,
`PORT=` to move it). With `SLOPSTUDIO_DESKTOP=1` (the default) there is no login; on a
multi-user server unset it and set `SLOPSTUDIO_API_TOKEN` (+ optional
`SLOPSTUDIO_API_TOKEN_USER=<email>`) so agents authenticate with
`Authorization: Bearer <token>`. `pnpm test:eval` runs the scored editing tasks in
`tests/eval/` against a running app (`BASE_URL` to point elsewhere). The agent-facing route
reference is [AGENT-API.md](AGENT-API.md); the MCP server that wraps it for Claude / Codex is
`pnpm mcp` (`mcp/README.md`, acceptance test `pnpm test:mcp`).

## 7. End-to-end tests (Playwright)

`tests/e2e/` drives the real app (the running dev server, the SQLite desktop target, the
system ffmpeg) with **Playwright** + the system Chromium at this laptop's logical viewport
(936×490). It covers the start screen and Assembly dialog (presets, custom sizes, Open
tab), workspace layout/menus/resize round-trip, every export format (real renders with LUT
+ libass captions + effects, probed with ffprobe), the Polish LUT/caption controls, the
effect stack, the Audio Studio tools (RNN denoise, leveler, stretch, audiogram, FLAC
mixdown), the MKV import path and the leave guard.

```bash
pnpm dev                      # or the desktop launcher — tests reuse a running :3000
pnpm test:e2e                 # ~2–3 min; creates and deletes "(pw)" projects
pnpm test:e2e:ui              # Playwright UI mode
PW_CHROMIUM=/path/to/chromium pnpm test:e2e   # if Chromium isn't at /usr/bin/chromium
```

`playwright.config.ts` runs one worker (renders share the GPU) and keeps traces and
screenshots for failures under `test-results/` (gitignored).

## Windows setup

Use [WINDOWS-CODEX.md](WINDOWS-CODEX.md) for the native Electron desktop and
Codex harness. Install Node 24, Git, FFmpeg, and the project dependencies, then
run `corepack pnpm codex:setup` and `corepack pnpm desktop:prod`.
No WSL, Bash script-shell, or PostgreSQL is needed for this SQLite target.
`corepack pnpm desktop:build:win` produces the Windows NSIS installer.

For web/PostgreSQL development, follow the database and web sections above;
WSL remains an option for that target. Optional Python audio tools can be installed
locally with `scripts/setup-audio.ps1`.

---
## Quick start (Linux/WSL, web target)

```bash
corepack enable
pnpm install
pnpm db:generate
# ensure Postgres is up + DATABASE_URL points at slopstudio_pro, then:
pnpm exec prisma db push
pnpm tsx --env-file=.env scripts/create-admin.ts you@local 'password' ADMIN
# optional Audio Studio:
python3 -m pip install --user --break-system-packages demucs openai-whisper torchcodec
pnpm dev      # → http://localhost:3000
```
