# SlopStudio Pro — Dependencies & Setup

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
  activates mise, clears a stale :3000 server, and runs `pnpm desktop:dev`.
  `~/.local/share/applications/slopstudio-pro.desktop` puts **SlopStudio Pro** in the
  Omarchy app menu. Electron opens a native Wayland window
  (`ELECTRON_OZONE_PLATFORM_HINT=wayland` is set by Omarchy's Hyprland env).
- **`.npmrc`** — the Windows-only `script-shell=C:\PROGRA~1\Git\bin\bash.exe` line was
  removed from the repo (it made every `pnpm <script>` fail on Linux with ENOENT).
  Windows devs set it in their **user** `%USERPROFILE%\.npmrc` instead — see Option B.

---

## Windows setup

The codebase is portable Node/TypeScript and runs on Windows, **but a few pieces are
Linux-shaped today.** Two viable paths:

### Option A — WSL2 (recommended, closest to this Linux dev box)

Install **WSL2 + Ubuntu**, then follow the Linux instructions verbatim:
`scripts/pg.sh`, the Python stack, `pnpm dev`. Everything above works unchanged.
The only thing WSL doesn't do well is **building/running the Electron *desktop* app**
(GUI) — do that natively on Windows (Option B) or just develop the web target in WSL.

### Option B — Native Windows

What changes vs. Linux:

1. **Node + pnpm + Git** — install natively (nvm-windows or the Node installer;
   `corepack enable` for pnpm). No change.
2. **PostgreSQL** — `scripts/pg.sh` is **bash and won't run** on native Windows. Install
   PostgreSQL for Windows (or run it in Docker Desktop), create a `slopstudio_pro`
   database + a `spotforge` role, and set `DATABASE_URL` to it. Then `pnpm exec prisma
   db push` + `create-admin`.
3. **ffmpeg** — install ffmpeg for Windows and put `ffmpeg.exe`/`ffprobe.exe` on PATH
   (e.g. `winget install Gyan.FFmpeg`), or set `SLOPSTUDIO_FFMPEG_DIR` to their folder.
4. **Audio Studio Python deps** — install Python 3.x for Windows, then
   `pip install demucs openai-whisper torchcodec` (no `--break-system-packages` needed
   on Windows). For GPU, install the CUDA build of torch from pytorch.org. **torchcodec
   is still required** for saving. Set `SLOPSTUDIO_PYTHON` to your `python.exe` /
   venv if `python3` isn't on PATH (on Windows the launcher is usually `py` or
   `python`).
5. **pnpm scripts use Unix shell syntax** (inline env vars, `rm -rf`, `&&`). Put
   `script-shell=C:\PROGRA~1\Git\bin\bash.exe` in your **user** `%USERPROFILE%\.npmrc`
   (8.3 short path avoids the space in "Program Files"). It is deliberately *not*
   in the repo `.npmrc` any more — a project-level value can't be overridden and
   broke every script on Linux.
6. **Desktop build for Windows** — the AppImage target is Linux-only. To make a Windows
   build you'd add an electron-builder **`win` target** (NSIS or portable), and:
   - bundle **Windows** ffmpeg/ffprobe `.exe` (the `vendor/ffmpeg` binaries are Linux
     ELF — `scripts/fetch-ffmpeg.sh` would need a Windows branch),
   - ensure Prisma's **Windows query engine** is traced into the standalone (Prisma
     downloads the right engine per-platform; build on Windows so the native engine +
     `@node-rs/argon2` Windows binary are included).
   This isn't wired yet — **flag it as a follow-up** if you need a distributable Windows
   desktop app. The **web** target needs none of this.

### Recommended Windows workflow

- **Develop the web app in WSL2** (matches this box; Python/Postgres/ffmpeg all "just
  work").
- Or **native Windows web dev** with the four changes above.
- Treat the **Windows *desktop* build as a separate task** (needs the `win` target +
  Windows ffmpeg + a Windows build host).

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
