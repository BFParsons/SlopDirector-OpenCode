# SpotForge — CLAUDE.md

Prototype **political ad generator**. One OpenRouter key drives the whole AI
pipeline: LLM script/storyboard → per-shot video → TTS voiceover → ffmpeg
stitches a final MP4. Multi-user with auth. Single Hetzner box via Docker.

> **Full reference:** [`README.md`](README.md) documents the complete feature
> set, data model, ffmpeg pipeline, env vars, and the live production setup
> (Hetzner + Caddy + YouTube cookies). This file is the condensed architecture
> guidance.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · pnpm · Node 22 ·
Prisma 6 + PostgreSQL · Zod 4 · Zustand 5 · argon2id sessions · ffmpeg.

## The political-content rule (important)

Two layers, handled differently — see `src/lib/llm/prompts.ts`:

- **Text** (concept / script / voiceover) **may name and critique real
  politicians** — this is legitimate, lawful ad copywriting and must not be
  refused. The lever is *model choice* (`DEFAULT_LLM_MODEL`) + the system prompt.
- **Video prompts** must describe **generic/archetypal** people and scenes,
  never a specific real person's likeness. This keeps visuals within video-model
  policies (Veo/Sora block public figures) and out of deepfake territory.
  Identifiable real individuals enter only via **user-uploaded reference images**
  (image-to-video).

No guardrails are removed.

## Architecture

- **Durable job queue** (`Job` table) is the source of truth. The **worker**
  (`src/lib/jobs/worker.ts`) claims jobs with Postgres `FOR UPDATE SKIP LOCKED`,
  runs them with per-type concurrency caps (clip downloads capped to
  `MAX_CONCURRENT_VIDEO`, ffmpeg assembly to `MAX_CONCURRENT_ASSEMBLY`), and
  survives restarts (stale-lease recovery + everything in Postgres). It boots
  in-process from `src/instrumentation.ts` when `WORKER_ENABLED` is on (prod),
  **or** as a standalone process via `pnpm worker` (dev — keeps a render spike
  out of the Next dev server's heap; see Local setup). Clip downloads **stream
  to disk** (`saveAssetStream`), never buffering a whole video in memory.
- **Video** is async: `SUBMIT_SHOT` → provider job id stored on `Shot` →
  advanced by **webhook** (`/api/webhooks/openrouter`, primary) **or** the
  **`RECONCILE_VIDEO` poller** (safety net; the only mechanism in local dev
  where no public webhook URL exists) → `DOWNLOAD_CLIP`.
- **Voiceover** (`SYNTH_VO`) runs in parallel.
- `maybeEnqueueAssembly()` (orchestrator) fires **`ASSEMBLE_FINAL` exactly once**
  via an atomic `FinalRender` PENDING→RUNNING transition, when all shots + VO are
  READY. ffmpeg work in `src/lib/ffmpeg/assemble.ts` (spawned child process).
- **Progress** streams to the browser over **SSE** (`/api/projects/[id]/events`)
  via an in-process `EventEmitter` bus; the client `projectStore` reduces events
  and refetches the snapshot on coarse status changes.

State machine (`AdStatus`): `DRAFT → SCRIPTING → STORYBOARD_READY →
RENDERING_SHOTS (+VO) → ASSEMBLING → DONE`, or `FAILED`. Partial failures are
per-unit recoverable (retry one shot / VO without redoing the rest).

## Layout

- `src/lib/openrouter/` — `client` (auth+retry), `chat`, `tts`, `video`.
- `src/lib/llm/` — `prompts`, `adSchema` (Zod + JSON schema), `expand` (one
  structured call + repair retry).
- `src/lib/jobs/` — `queue`, `worker`, `orchestrator`, `handlers`, `progressBus`.
- `src/lib/ffmpeg/` — `args`, `probe`, `assemble`.
- `src/lib/assets/` — `storage` (filesystem under `ASSET_ROOT`), `serve`
  (Range-aware, auth-gated streaming).
- `src/config/models.ts` — curated model catalog, defaults, caps, frame dims.
- `src/app/api/...` — route handlers; all return `{ data, error, meta? }`.
- `src/components/`, `src/stores/projectStore.ts` — UI.

## Local setup

1. **Postgres.** On a box with sudo:
   ```bash
   sudo -u postgres psql -c "CREATE ROLE spotforge LOGIN PASSWORD 'spotforge_dev';" \
                         -c "CREATE DATABASE spotforge OWNER spotforge;"
   ```
   On the no-sudo dev box, use the **user-owned instance** on port **5434**:
   `scripts/pg.sh {start|stop|status}` (data in `.data/pg`; `DATABASE_URL`
   already points at `localhost:5434`).
2. Put your key in `.env`: `OPENROUTER_API_KEY="sk-or-..."`.
3. `pnpm db:migrate`, then in **two terminals**: `pnpm dev` (web) and
   `pnpm worker` (job worker). Splitting them keeps a render spike from
   ballooning the dev server's heap. To run single-terminal instead, set
   `WORKER_ENABLED="true"` in `.env` and just `pnpm dev`.
4. Register at `/register` — **the first account becomes ADMIN** (admins can use
   the pricey models like Veo).

## Cost guardrails

Video dominates. A 30s ad ≈ $0.87 (Kling) / $1.50 (Wan) / $22.50 (Veo). Caps:
≤8 shots, ≤8s/shot, ≤60s total (enforced in Zod + the LLM output schema).
Confirm-before-render shows an estimate; per-user monthly quota
(`User.quotaAdsMonth`); Veo gated to ADMIN.

## Deploy (Hetzner)

`docker compose up -d --build` (compose runs `prisma migrate deploy` then boots).
Set `OPENROUTER_API_KEY`, `AUTH_SECRET`, `PUBLIC_BASE_URL` (https), and
`OPENROUTER_WEBHOOK_SECRET` in the environment. Behind nginx, **disable
buffering on the SSE route** (`proxy_buffering off;` for `/api/.../events`), and
proxy the rest normally. Assets live on the `assets` volume and are served only
through the auth-gated `/api/assets/[id]` route — never expose `ASSET_ROOT`
directly.

## Open items / to confirm against OpenRouter's live API

- **Webhook signature scheme** (`X-OpenRouter-Signature`) is assumed HMAC-SHA256
  over the raw body — verify before trusting webhook-driven transitions; the
  reconciler covers correctness regardless. `src/app/api/webhooks/openrouter`.
- **Model IDs and per-second prices** in `src/config/models.ts` are best-effort —
  confirm and adjust; the picker can also pull the live list from
  `/api/models/video`.
- **`DEFAULT_LLM_MODEL`** — set to a permissive model that won't refuse named
  political criticism.
- **Image-to-video frame encoding**: FIRST_FRAME/LAST_FRAME currently both map to
  `frame_images[0]`; pin down per-model first-vs-last semantics.
- Fonts use a system stack (no CDN). Swap to `@fontsource/*` if a branded face is
  wanted.
