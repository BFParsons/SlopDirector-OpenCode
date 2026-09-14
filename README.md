# SlopStudio-Omarchy

**Windows + Codex:** Native Electron/SQLite launchers, Windows packaging and the
interview-driven Codex editing workflow are documented in
**[docs/WINDOWS-CODEX.md](docs/WINDOWS-CODEX.md)**. Start with
`corepack pnpm codex:setup`, then `corepack pnpm desktop:prod`.

SlopStudio Pro for **Omarchy** (Arch Linux + Hyprland) — the desktop NLE fork **without the Storyboard mode**, fitted to a 1080p laptop at 2× scale. Upstream: `BFParsons/slopstudio-pro`.

> **This fork removes the Storyboard mode** (the AI concept → shot-list board, its
> story-element library and keyframe image generation via fal.ai). The start screen
> offers **Assembly** and **Audio Studio** (existing projects open from the Assembly
> dialog); single AI shots, script /
> voiceover generation, and everything else are unchanged. Mentions of storyboards
> below are historical. See `docs/CHANGELOG.md`.

## The agent harness

This fork adds a harness that lets an agent — Claude Code, or any MCP client — edit in the
running app the way an editor would: interview the person, propose a plan, source and cut,
check its own work, render. All of it is in this repository:

| piece | where | what |
|---|---|---|
| MCP server | [`mcp/`](mcp/README.md) | 68 tools and 4 prompts over the app's HTTP API — project, media, inspect, timeline, render, verify, pre-production, sourcing, typography, guide. `pnpm test:mcp` runs 78 acceptance checks against the running app. |
| The editing guide as knowledge | [`guide/`](guide/) | [`editing-guide.md`](guide/editing-guide.md) (Part II is the harness: sound §7, pre-production §11, typography §12), [`RULES.md`](guide/RULES.md) (38 always-on rules), [`playbooks/`](guide/playbooks/), [`appendix-a-tools.md`](guide/appendix-a-tools.md) (generated from the server). |
| Directing styles | [`guide/styles/`](guide/styles/README.md), `src/lib/styles` | 43 filmmakers and houses across nine categories, asked for in the interview; each file is the signature, structure, the cut (numbers), narration, sound, picture and text, type, harness parameters, applying it — and `check_plan`, `pacing_report`, `check_soundtrack` hold the piece to it. |
| Typography on safe areas | `src/lib/typography`, [`public/fonts`](public/fonts/LICENSES.md) | safe-area profiles (web, broadcast, social 9:16, square) anchoring every text and caption in the render, the preview and the checks; 43 bundled open-licence faces; presets; a surveyed type system per style (`add_text_overlay {role}`). |
| Sub-agents | [`.claude/agents/`](.claude/agents/) | clip-scout, narrator, shot-picker — the fan-out after approval. |
| Watching it work | the Agent panel; the invisible-editor follow mode | the open editor shows the work as it happens: clips arrive, the playhead follows, the draft takes the monitor. |

**The flow.** `interview_next` (one question at a time, multiple choice: form, your own
script or shot list, length, frame, genre, directing style, sources, premise, tone,
narration, music, text, guardrails) → `set_brief` → `get_style` → the plan (`set_plan`,
`check_plan`, `plan_document` as boxed terminal tables) → the person's yes
(`approve_plan`) → `plan_tasks` fanned out → the cut → `check_cuts`, `pacing_report`,
`check_soundtrack`, `check_text` → `render_draft` → `verify_export` → `render_final`.
Nothing is sourced or cut before approval.

**Run it.** Start the app — `pnpm desktop:prod` (Electron), `pnpm desktop:dev` (HMR),
or `pnpm serve:headless` (no window); all bind `127.0.0.1:38473`. On Linux,
`scripts/launch-desktop.sh --prod` does the same.

**Drive it.** The loop is canonical and host-neutral in
[`docs/HARNESS-LOOP.md`](docs/HARNESS-LOOP.md); the two host briefs carry it in their own
idiom and are kept at parity: [`CLAUDE.md`](CLAUDE.md) for **Claude Code** (`.mcp.json`
registers the server in-repo — no setup step; AskUserQuestion; the `.claude/agents`
fan-out) and [`AGENTS.md`](AGENTS.md) for **Codex and other MCP clients**
(`pnpm codex:setup`; see [`docs/WINDOWS-CODEX.md`](docs/WINDOWS-CODEX.md)).
[`mcp/README.md`](mcp/README.md) has the server setup for other clients,
[`docs/AGENT-API.md`](docs/AGENT-API.md) the routes, [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
the history.

# SlopStudio (formerly SpotForge)

A browser-based, **Premiere-style non-linear video editor** with built-in AI generation:
a floating-panel workspace, a draggable/resizable multi-track timeline, a live canvas
preview, generic audio/video tracks, a Media Bucket, and one-shot AI video + voiceover
generators. ffmpeg stitches the final MP4.

> **The editor (NLE) is documented in [`docs/SLOPSTUDIO.md`](docs/SLOPSTUDIO.md).** The rest
> of this README covers the original generation pipeline, data model, ffmpeg internals, env
> vars, and the production deploy — most of which still underpins the editor.

> ### 🛠 Setup, dependencies & Windows
> **SlopStudio Pro** is the desktop+web fork. Start here:
> - **[`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md)** — every dependency (Node/pnpm, Postgres/SQLite,
>   ffmpeg, the Audio Studio Python/ML stack incl. the **torchcodec** requirement) **+ a
>   dedicated Windows setup section.**
> - **[`docs/AUDIO_STUDIO.md`](docs/AUDIO_STUDIO.md)** — the DAW-style audio workspace (Demucs / Whisper).
> - **[`docs/TIMELINE.md`](docs/TIMELINE.md)** — the unified multi-layer video+audio timeline (N layers, waveforms, tempo/beats, render parity).
> - **[`docs/PROJECT_BUNDLES.md`](docs/PROJECT_BUNDLES.md)** — portable per-project folders (project.json + assets) and the storage model.
> - **[`docs/CHANGELOG.md`](docs/CHANGELOG.md)** — recent changes (newest first).
> - **[`docs/DESKTOP.md`](docs/DESKTOP.md)** — Electron / AppImage architecture.

---

Prototype **political-ad generator**. A single OpenRouter API key drives the whole
AI pipeline — LLM script/storyboard → per-shot AI video → TTS voiceover → ffmpeg
stitches a final MP4 — alongside hand-uploaded footage, photos, and YouTube clips,
arranged on an Adobe Premiere-style timeline.

**Live:** https://your-domain.example/vid (password-gated, Canada-only). Self-hosted on a
single Hetzner box via Docker.

> See also: [`CLAUDE.md`](CLAUDE.md) (architecture guidance) and
> [`DEPLOY.md`](DEPLOY.md) (generic single-box deploy runbook). This file is the
> full human-facing reference.

---

## Contents

0. [The agent harness](#the-agent-harness) — this fork's addition
1. [What it is](#what-it-is)
2. [The political-content rule](#the-political-content-rule)
3. [Features](#features)
4. [Architecture](#architecture)
5. [The ffmpeg assembly pipeline](#the-ffmpeg-assembly-pipeline)
6. [Data model](#data-model)
7. [Local development](#local-development)
8. [Configuration (env vars)](#configuration-env-vars)
9. [Production deployment & ops](#production-deployment--ops)
10. [Known limitations & roadmap](#known-limitations--roadmap)

---

## What it is

A multi-user web app for producing short political ads end to end. Two
**independent tracks** — *visual* and *audio* — are composed separately and
combined only by duration at the final render (no lip-sync). Every AI step is
optional: you can generate a storyboard and voiceover with the LLM/TTS, or build
the whole ad from uploaded clips, photos, and YouTube grabs.

Stack: **Next.js 16** (App Router) · React 19 · TypeScript · Tailwind 4 ·
pnpm · Node 22 · **Prisma 6 + PostgreSQL** · Zod 4 · Zustand 5 · argon2id
sessions · **ffmpeg** · **yt-dlp + Deno** (YouTube import). AI via **OpenRouter**.

---

## The political-content rule

Two layers, handled differently (see `src/lib/llm/prompts.ts`):

- **Text** (concept / script / voiceover) **may name and critique real
  politicians** — legitimate ad copywriting. The lever is model choice
  (`DEFAULT_LLM_MODEL`) + the system prompt.
- **Video prompts** describe **generic/archetypal** people and scenes, never a
  specific real person's likeness — this keeps visuals within video-model policy
  (Veo/Sora block public figures) and out of deepfake territory. Identifiable
  real individuals enter only via **user-uploaded reference images**
  (image-to-video) or uploaded footage.

No guardrails are removed.

---

## Features

### Project & brief
- Title, goal, subject (politician/issue), tone, target length, aspect ratio
  (16:9 / 9:16 / 1:1), resolution (480/720/1080p), shot count.
- AI generation is opt-in per track.

### Visual track
- **AI shots** — text prompt → AI video (per-shot model override; mix & match).
- **Uploaded video** used directly.
- **Photos (stills)** shown for a set duration, with **pan/scan/zoom** motion
  (incl. *subtle* zoom that letterboxes off-aspect images to preserve them).
- **Photo → AI clip** (image-to-video driver: a photo seeds/styles a generated clip).
- **Optional reference image** for AI shots (first-frame / last-frame / style).
- **YouTube import/clipper** — paste a URL, scrub & trim in an embedded player,
  import the section as a video segment. In-timeline **re-cut** (change start/end
  without re-importing).
- **Cross-project reuse** — a gallery of all your clips/photos across projects;
  reused assets are copied into the current project so a deleted source can't
  break it.
- **Per-segment playback speed** (0.5×–2×).
- **Drag-to-reorder** (vertical list or horizontal timeline).
- **Per-segment AI video model** override.
- Rendered clips collapse to just the result (prompt/model/ref-image controls hide).

### Audio track
- Modes: **AI-written script → TTS**, **verbatim transcript → TTS**, **upload a
  master audio track**, or **silent**.
- **Delivery notes** passed to TTS (graceful fallback if the model rejects them).
- **Music bed** mixed *under* the voice, with volume + optional **sidechain
  ducking** (lowers the bed under the VO) and an end fade. Loops to fill.
- **Audio overlays** — grab **audio-only** clips from YouTube that play **over**
  everything (VO/music/clip audio), each with a start offset, volume, and an
  include toggle. Mixed on top, trimmed to the video length.
- **Audio fit** — pad/freeze the last video frame for a longer VO, or trim the
  audio to the video length.

### Production polish (applied at final assembly)
- **Transitions** between segments — crossfade, dissolve, fade-through-black,
  wipe, slide (adjustable duration).
- **Color looks** — warm, cool, B&W, vintage, punch.
- **Loudness normalization** to −14 LUFS (EBU R128).

### Timeline Mode (Adobe Premiere-style)
- Toggle (bottom action bar) swaps the vertical card list for a horizontal,
  scrollable timeline with a time ruler and zoom (px/sec).
- **V1 video track**: clip blocks sized by on-screen duration, color-coded by
  type, with **preview frames** (still image, or the video's first frame).
- **Audio lanes**: Voiceover, Music bed (full-span, "loops"), and Overlays
  positioned at their offsets — so the video-vs-audio length mismatch is visible.
- **Drag-to-reorder** video blocks (cascades, no dead air).
- **Trim tool** — drag a clip's right edge to shorten *or extend back* (in 0.1s
  steps, up to the clip's real source length). Shortening cascades the rest left.

### UI / UX
- Dark "premium" theme using **Adobe's open-source typefaces** (Source Sans 3 for
  UI, Source Code Pro for timecodes/cost), self-hosted via `@fontsource`.
- "Squishy" tactile motion — bouncy spring on press (scale-down + pop-back),
  hover grow/lift, soft layered shadows, accent focus glow, slim scrollbars.
  Respects `prefers-reduced-motion`.
- Color-coded, animated-gradient clip edges; "picked up" tilt/scale/ring on drag.
- **Running cost** bar (live estimate while editing).
- **Flip-clock** display of estimated cost + final length above the rendered video.
- Live render progress over SSE (+ a polling fallback for background work).

### Accounts & cost control
- **No public registration.** The first admin is seeded from the CLI
  (`pnpm create-admin`); all other users are created in-app at `/admin/users`
  (admin only). argon2id password hashing, rate-limited login.
- **Per-user OpenRouter key** (`/settings`) — billed to the user; AES-256-GCM
  encrypted at rest; falls back to the shared server key when unset.
- **Cost estimation** — only AI work is billed (AI/driver shots at their per-shot
  model price + TTS chars). Confirm-before-render shows an estimate; per-user
  monthly quota; pricey models (e.g. Veo) gated to admins.

---

## Architecture

- **Durable job queue** (`Job` table) is the source of truth. The **worker**
  (`src/lib/jobs/worker.ts`) claims jobs with Postgres `FOR UPDATE SKIP LOCKED`,
  runs them with per-type concurrency caps, and survives restarts (stale-lease
  recovery; everything in Postgres). It boots in-process from
  `src/instrumentation.ts` when `WORKER_ENABLED` is set (prod), **or** as a
  standalone process via `pnpm worker` (dev).
  - `DOWNLOAD_CLIP` / `IMPORT_YOUTUBE` / `IMPORT_AUDIO` are capped by
    `MAX_CONCURRENT_VIDEO`; **YouTube imports are serialized to one at a time**
    (they share one cookies file that yt-dlp rewrites).
  - `ASSEMBLE_FINAL` is capped by `MAX_CONCURRENT_ASSEMBLY`.
- **Video** is async: `SUBMIT_SHOT` → provider job id on the segment → advanced by
  **webhook** (`/api/webhooks/openrouter`, primary; fails closed if the secret is
  unset) **or** the **`RECONCILE_VIDEO` poller** (safety net; the only path in
  local dev where no public webhook URL exists) → `DOWNLOAD_CLIP`.
- **Voiceover** (`SYNTH_VO`) runs in parallel.
- `maybeEnqueueAssembly()` fires **`ASSEMBLE_FINAL` exactly once** (atomic
  `FinalRender` PENDING→RUNNING) when all shots + VO are ready.
- **Progress** streams to the browser over **SSE** (`/api/projects/[id]/events`)
  via an in-process `EventEmitter` bus; the client `projectStore` (Zustand)
  reduces events and **polls** (2.5s) while background work is active (imports,
  generation, rendering, audio-overlay downloads) as a cross-process fallback.
- **Assets** live on the filesystem under `ASSET_ROOT` and are served only through
  the auth-gated, Range-aware `/api/assets/[id]` route — `ASSET_ROOT` is never
  exposed directly.

State machine (`AdStatus`): `DRAFT → RENDERING → DONE | FAILED`. Partial failures
are per-unit recoverable (retry one shot / VO / import without redoing the rest).

### Layout
- `src/lib/openrouter/` — `client` (auth+retry), `chat`, `tts`, `video`, `userKey`.
- `src/lib/llm/` — `prompts`, `adSchema`, `expand`.
- `src/lib/jobs/` — `queue`, `worker`, `orchestrator`, `handlers`, `progressBus`.
- `src/lib/ffmpeg/` — `args`, `probe`, `assemble`.
- `src/lib/assets/` — `storage`, `serve`.
- `src/lib/youtube/` — `url`, `import` (yt-dlp video + audio download).
- `src/config/models.ts` — model catalog, defaults, caps, frame dims.
- `src/app/api/...` — route handlers; all return `{ data, error, meta? }`.
- `src/components/`, `src/stores/projectStore.ts` — UI.

---

## The ffmpeg assembly pipeline

`src/lib/ffmpeg/assemble.ts` builds one `filter_complex` and spawns ffmpeg.

- **Per-segment video chain:** `scale`→`pad`→`setsar`→`fps`→`format` (normalize to
  the target frame), then per-segment **speed** (`setpts=(PTS-STARTPTS)/speed`),
  **color look**, a **trim** to the segment's on-screen length (`trim=0:effDur` —
  this is what the timeline trim tool drives), ending in `fps` so the link reports
  a **constant frame rate** (xfade rejects variable-rate inputs; a trailing
  `setpts` leaves the rate undefined as `1/0`).
  - `effDur` (on-screen length) = `min(durationS, sourceLength/speed)` for video;
    `durationS` for stills.
- **Transitions:** `xfade` chained between segments with computed offsets, or
  `concat` for hard cuts. Transition duration is clamped so offsets stay positive.
- **Audio fit:** `tpad` clones the last frame to pad video to a longer VO
  (`PAD_VIDEO`), else the audio is trimmed to the video length (`TRIM_VO`).
- **Audio graph:** voiceover + music bed (volume, optional `sidechaincompress`
  ducking keyed off the VO, end `afade`) → primary; plus each **unmuted clip's**
  own audio (`atempo` for speed, `adelay` to its timeline offset); plus **audio
  overlays** (`volume`, `adelay` to offset, bounded to the final length). All
  `amix`ed, then optional **`loudnorm=I=-14:TP=-1.5:LRA=11`**.
- Output: H.264 + AAC MP4, `+faststart`, progress parsed from `-progress pipe:1`.

---

## Data model

Prisma + Postgres (`prisma/schema.prisma`). Key models:

- **User** — `role` (USER/ADMIN), `quotaAdsMonth`, encrypted
  `openrouterKeyEnc` + masked `openrouterKeyHint`.
- **Session** — argon2id-backed sessions.
- **Project** — brief (goal/subject/tone), `aspectRatio`/`resolution`/
  `targetLengthS`/`shotCount`, audio (`audioMode`, `voScript`, `voVerbatim`,
  `voDeliveryNotes`, `musicAssetId`/`musicVolume`/`musicDucking`), polish
  (`audioNormalize`, `colorLook`, `transition`/`transitionMs`), models
  (`llmModel`/`videoModel`/`ttsModel`/`ttsVoice`), generation state, `status`.
- **Segment** — `source` (AI_GENERATED / UPLOAD_VIDEO / UPLOAD_IMAGE_STILL /
  UPLOAD_IMAGE_DRIVER), `prompt`, per-segment `videoModel`, `speed`, **`durationS`
  (float — on-screen length)**, **`sourceDurationS`** (real source length; cap for
  re-extending a trim), `imageMotion`, `muted`, `status`, YouTube import fields
  (`importUrl`/`importStartS`/`importEndS`), `sourceAssetId`, `refImageId`/
  `refRole`, `clipAssetId`, `providerJobId`.
- **AudioOverlay** — YouTube audio mixed over the final: `assetId`, `sourceUrl`,
  `importStartS`/`EndS`, `offsetS`, `volume`, `included`, `durationS`, `status`.
- **VoiceoverAsset**, **FinalRender**, **Asset** (kinds: UPLOAD_IMAGE/VIDEO/AUDIO,
  OVERLAY_AUDIO, SHOT_CLIP, VO_AUDIO, FINAL_MP4), **Job** (durable queue).

---

## Local development

> **Omarchy / Arch (current dev box):** no Postgres needed — the desktop target runs
> in dev on embedded SQLite. Node 22 is pinned via `mise.toml`. Launch with
> `scripts/launch-desktop.sh` or the **SlopStudio Pro** app-menu entry. Details:
> [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md#omarchy--arch-linux-setup-desktop-target-dev-no-postgres).

No-sudo Debian dev box uses a **user-owned Postgres** on port **5434**:

```bash
scripts/pg.sh init           # once: initdb in .data/pg + role + DB, port 5434
scripts/pg.sh start          # later boots (DATABASE_URL points here)
# put your key in .env:  OPENROUTER_API_KEY="sk-or-..."
pnpm install
pnpm db:migrate
pnpm dev                     # web (terminal 1)
pnpm worker                  # job worker (terminal 2) — keeps a render spike out of the dev heap
```

Single-terminal alternative: set `WORKER_ENABLED="true"` in `.env` and just
`pnpm dev`.

Seed the first admin (also resets a password):
```bash
pnpm create-admin you@example.com 'a-strong-password' ADMIN
```

YouTube import in dev needs `yt-dlp` (recent), cookies
(`YTDLP_COOKIES_FROM_BROWSER=firefox`), and **Deno** on PATH (solves YouTube's
n-challenge via `--remote-components ejs:github`).

---

## Configuration (env vars)

| Var | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Shared fallback key (used when a user has no personal key) |
| `AUTH_SECRET` | Session signing **and** per-user key encryption — keep stable |
| `DATABASE_URL` | Postgres connection string |
| `PUBLIC_BASE_URL` | Public https URL; enables webhook-driven video transitions |
| `OPENROUTER_WEBHOOK_SECRET` | Required if `PUBLIC_BASE_URL` is set (webhook fails closed otherwise) |
| `NEXT_PUBLIC_BASE_PATH` | Subpath the app is served under (e.g. `/vid`) — build arg + runtime |
| `TRUST_PROXY` | `true` behind a reverse proxy (correct client IPs for rate limits) |
| `WORKER_ENABLED` | Boots the in-process worker (prod) |
| `MAX_CONCURRENT_VIDEO` / `MAX_CONCURRENT_ASSEMBLY` | Worker concurrency caps (default 3 / 1) |
| `YT_IMPORT_MAX_SECONDS` | Max YouTube clip length (default 180) |
| `YTDLP_BIN`, `YTDLP_COOKIES`, `YTDLP_COOKIES_FROM_BROWSER`, `YTDLP_REMOTE_COMPONENTS` | YouTube import tooling |
| `ASSET_ROOT` | Filesystem root for stored assets |

Verified model defaults (`src/config/models.ts`): LLM `google/gemini-3.5-flash`
(won't refuse named political copy), video `alibaba/wan-2.7`, TTS
`x-ai/grok-voice-tts-1.0`.

---

## Production deployment & ops

**Topology.** The app + Postgres run in Docker on a dedicated Hetzner box. A
**Caddy** reverse proxy on a separate box terminates TLS for `your-domain.example`,
enforces a **Canadian-IP allowlist**, and proxies `/vid` to the app. The app's
port 3000 is firewalled (DOCKER-USER iptables) to accept only the Caddy box.

**The image** bundles ffmpeg + yt-dlp + Deno. The container CMD runs
`prisma migrate deploy` then starts — so **migrations auto-apply on boot**.

**Deploy recipe** (from the dev box; the prod box has no git remote):
```bash
rsync -az --delete \
  --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.data' \
  --exclude='.env' --exclude='.env.bak.*' \
  --exclude='docker-compose.yml' --exclude='docker-compose.yml.bak.*' \
  --exclude='yt-cookies.txt' --exclude='public/assets' --exclude='tsconfig.tsbuildinfo' \
  ./ root@<box>:/opt/spotforge/
ssh root@<box> 'cd /opt/spotforge && docker compose up -d --build'
```
`.env`, `docker-compose.yml`, and `yt-cookies.txt` are **server-owned** and never
overwritten by the sync.

**YouTube cookies (important).** Server-side yt-dlp can't use a browser session,
and YouTube increasingly demands authentication ("confirm you're not a bot"). A
Netscape `cookies.txt` (ideally from a throwaway Google account) lives at
`/opt/spotforge/yt-cookies.txt`, mounted **read-write** to `/secrets/yt-cookies.txt`
with `YTDLP_COOKIES` pointing at it. yt-dlp is pointed straight at this file so it
**persists YouTube's rotated session tokens** — discarding that refresh makes the
cookies go stale within minutes. YouTube imports are serialized so concurrent runs
don't corrupt the shared file. Cookies still expire periodically (and the
datacenter IP is bot-flagged more aggressively); when imports start failing,
re-export `cookies.txt` and overwrite the file (read live per job — no restart).

**Deploy gotchas (already handled):**
- `packageManager: pnpm@10.x` pinned (container corepack pulled an older pnpm).
- `binaryTargets = ["native","debian-openssl-3.0.x"]` in the Prisma generator
  (the slim image mis-detected the query engine).
- Caddy `admin off` → apply config via `systemctl restart caddy`, not reload.
- Subpath served via a `@vid path /vid /vid/*` matcher (avoids the
  Caddy-adds-slash ↔ Next-strips-slash redirect loop).
- `withBase()` (`src/lib/basePath.ts`) prefixes raw fetch/EventSource/asset `src`
  with the base path (Next only auto-prefixes Link/router/redirect).

---

## Known limitations & roadmap

- **Trim re-extend** only works on clips imported/generated after the
  `sourceDurationS` field was added; older clips are shrink-only until
  re-imported/re-rendered. (A one-time backfill job could probe and populate them.)
- Timeline Mode is arrange/visualize + reorder + trim; **detailed per-clip edits**
  (prompt, model, motion) still happen in List Mode. Natural next steps: a moving
  **playhead + scrub-to-preview**, drag clips/overlays **along** the time axis
  (reposition), and click-a-block-to-edit.
- An SSE stream-teardown `uncaughtException` (Next 16, on client disconnect) is
  logged but non-fatal; could be quieted with a targeted handler.
- Webhook signature scheme (`X-OpenRouter-Signature`) is assumed HMAC-SHA256 over
  the raw body — the reconciler covers correctness regardless.
- Model IDs / per-second prices in `src/config/models.ts` are best-effort.
