# Agent API — driving SlopStudio from Claude / Codex

SlopStudio's editor is a JSON API with a UI on top. Everything the timeline can
do is a route under `/api`, the render engine is a job queue over ffmpeg, and
the open editor live-updates when something else edits the project. This is the surface the MCP server in [`mcp/`](../mcp/README.md) (`pnpm mcp`) builds on;
use that with Claude / Codex, and this document when you need the raw routes.

## Running it for an agent

| Mode | Command | Notes |
|---|---|---|
| Desktop app (a person watches) | app-menu entry / `scripts/launch-desktop.sh --prod` | API on `http://127.0.0.1:38473`, no auth (single local user) |
| Headless (CI, no display) | `pnpm serve:headless` (`--dev` for hot reload, `PORT=…`) | same DB and worker, no Electron |
| Multi-user server | unset `SLOPSTUDIO_DESKTOP`; set `SLOPSTUDIO_API_TOKEN` | agents send `Authorization: Bearer <token>`; `SLOPSTUDIO_API_TOKEN_USER=<email>` picks the account (default: first admin) |

Every request carries `X-Requested-With: spotforge` (CSRF marker). Send a
stable `X-Slop-Client: <id>` too: the server echoes it on `project.changed`
events so the sender can ignore its own edits. Responses are
`{ data, error }`; mutations return the full project snapshot unless noted.

## Project model, in one paragraph

A **project** has a frame (`frameWidth`/`frameHeight` or an aspect + resolution
preset), an export codec, project-wide looks (color look, LUT, transition,
fill mode, vignette, grain, captions, watermark), and an audio mode
(`NONE`, `UPLOAD_AUDIO`, `TTS_FROM_SCRIPT`, `TTS_VERBATIM`) with music and
voiceover. Its **segments** are the timeline: track 0 is the main sequence in
`index` order (each with `trimStartS`, `durationS`, `speed`, `muted`, `volume` (gain on the clip's own audio, 1 = as recorded),
`brightness/contrast/saturation`, `transform`, `effects[]`); tracks ≥ 1 are
positioned overlays (`offsetS`, `pip`); `audioOnly` segments are unlinked
audio clips at `offsetS`. **Assets** are media files (uploads, clips, LUTs,
renders). **Text overlays** and **audio overlays** sit on top.

## Endpoints an agent uses

### Watching the agent (the Agent panel)
- `POST /api/activity {projectId | assetId, callId, phase: start|end, tool, args?, summary?, ok?, ms?, agent?}` — an agent reports a tool call; the MCP server does this for every tool automatically (`SLOPSTUDIO_AGENT_FEED=0` disables). Broadcast as `agent.activity` on `GET /api/projects/:id/events`; `GET /api/projects/:id/activity?limit=100` returns the recent history. The editor's Agent panel renders them.

### Pre-production
- `GET/PUT /api/projects/:id/brief` — the interview's outcome (`src/lib/validation/brief.ts`: deliverable standalone|scene, length, aspect; scripted + genre; sources; premise; tone; audience; narration/music/text; must-include/avoid).
  `production.style.id` names a directing style (`src/lib/styles`, prose in `guide/styles/<id>.md`); `check_plan` holds the plan to its parameters.
- `GET /api/projects/:id/plan?view=json|document|check|tasks` · `PUT …/plan` (validated, versioned, status proposed, writes `plan-v<N>.md` next to the assets) · `POST …/plan/approve`. The plan: beats, script lines with times, shots (source youtube+clipId | ai+prompt | upload | card; sound sync|muted|vo), clipList, aiShots, music, narration. `check` = length vs brief, pacing norm, sources, narration density/overlaps, caps, AI cost; `tasks` = the dependency graph to fan out.
- `GET /api/projects/:id/storyboard?cols=4&w=400` → JPEG, one captioned frame per main-sequence shot (header `X-Storyboard-Shots`).
- `GET /api/youtube/search?q=…&max=8` → yt-dlp search candidates (no download). `GET /api/youtube/captions?url=…&q=phrase&from=&to=&lang=en` → the caption track (manual, else auto) with timings, filtered to cues containing `q` — find the second a line is spoken before importing a short window. `GET /api/models` → video / TTS / chat models with prices and clip lengths. `POST …/generate-clip {videoModel, prompt, durationS}` starts an AI shot.

### Project
- `POST /api/projects` — create; body like the Assembly dialog (`title`, `frameWidth`, `frameHeight`, `audioMode`, model names).
- `GET /api/projects` · `GET /api/projects/:id` (snapshot) · `PATCH /api/projects/:id` (any setting; `segments: [{ id, …fields }]` edits segments in bulk) · `DELETE`.
- `GET /api/projects/:id/events` — SSE: `snapshot` on connect, then `project.status`, `segment.status`, `assembly.progress`, `final.ready`, `draft.ready`, `project.changed` (`clientId` of the editor that made the change).

### Media
- `POST /api/uploads` (multipart `projectId`, `file`) → asset. Video, image, audio; MKV/AVI/TS accepted.
- `POST /api/projects/:id/youtube` — import a URL (with `startS`/`endS`).
- `GET /api/assets/:id` — the file (Range supported). `GET /api/assets/:id/info` — duration, video stream, size, absolute path.

### Inspect (perception)
- `GET /api/assets/:id/frame?t=12.5&w=640` → JPEG of that instant.
- `GET /api/assets/:id/contact-sheet?cols=4&rows=3&w=1280&start=0&end=60` → JPEG grid, each cell stamped with its source time; header `X-Frame-Times`. Add `format=json` for the times only.
- `GET /api/assets/:id/scenes?threshold=0.4` → `{ cuts: [t…], shots: [{ startS, endS }] }`.
  Scenes, silences, analyze kinds and transcripts are cached by the file's *content*, so
  repeated calls — and the same clip copied into another project — answer in milliseconds.
- `GET /api/assets/:id/silences?noise=-30&min=0.5` → `{ silences: […], speech: [{ startS, endS }] }` (the ranges an edit keeps).
- `POST /api/assets/:id/transcribe { model?, language?, wait?, force? }` → Whisper transcript with `segments[]` and `words[]` (each `{ startS, endS, text }`); cached per asset+model, `GET` reads the cache. `wait:false` returns a `jobId` for `/api/audio/jobs/:id`.
- `POST /api/audio/analyze`, `/stems`, `/process`, `/mix` — the Audio Studio tools (loudness, stem separation, denoise/leveler/stretch, mixdown).

### Timeline
- `POST /api/projects/:id/segments` — add (`source: UPLOAD_VIDEO | UPLOAD_IMAGE_STILL | AI_GENERATED`, `sourceAssetId`, `trimStartS`, `durationS`, `track`, `offsetS`, `audioOnly`).
- `PATCH /api/projects/:id` with `segments: [{ id, trimStartS, durationS, speed, muted, volume, effects, transform, pip, offsetS, track, … }]` — edit any number at once. `volume` (0–4) is the gain on an unmuted shot's own audio or on an audio-only clip; the music bed ducks under every voice (VO, narration clips, unmuted shots).
- `POST /api/projects/:id/segments/:sid/split { atS }` · `POST …/segments/reorder { order: [ids] }` · `DELETE …/segments/:sid` · `POST …/segments/:sid/recut`.
- `POST /api/projects/:id/text-overlays` · `/music` · `/audio` (voiceover upload) · `/lut` · `/watermark` · `/generate-script` · `/generate-voiceover` · `/generate-clip`.
- Text overlays carry `font` (bundled face id), `outlineW` / `shadow` (% of the size), `preset`, `animation` NONE|FADE|SLIDE_UP|POP; they anchor to the title-safe area of `project.safeArea` (auto|web|broadcast|social|square|none) — `src/lib/typography`. `PATCH /api/projects/:id {safeArea}`. The MCP `add_text_overlay {role}` resolves the face, case, colour and entrance through the brief's directing style (`src/lib/typography/styleType.ts`); `preset` records `<style>:<role>`.
  Note: `/generate-voiceover` files the TTS clip in the media bucket (`library: true`), where the render and the checks never see it — add its asset as an audio-only segment (`offsetS`, `volume`) to put it on the timeline, which is what the MCP `generate_narration` tool does.

### Checkpoints (server-side undo)
- `POST /api/projects/:id/checkpoints { label? }` → `{ id, segments, … }`; `GET` lists; `GET …/:cid` includes the captured data.
- `POST /api/projects/:id/checkpoints/:cid/restore` — put settings, segments and overlays back exactly (same ids). Media and renders are untouched. Keeps the newest 50.

### Render
- `POST /api/projects/:id/render { draft: true }` — low-res preview (fits 640×360, fast H.264) of what exists now; no AI generation, no billing. Watch `assembly.progress` then `draft.ready`; the snapshot's `finalRender.draftAssetId` points at the file, also served at `GET /api/projects/:id/draft`.
- `POST /api/projects/:id/render` — the real export (runs AI shots / TTS if needed, then assembles at the project's frame and codec); `final.ready` carries the asset id. `GET …/render` previews cost and lists the host's export formats. `POST …/cancel`.

## A worked loop

1. Create a project at the target frame; upload the source; add it as one segment.
2. `silences` + `scenes` + `contact-sheet` on the source; decide the cuts.
3. `POST checkpoints` ("before edit").
4. Re-cut: add one segment per kept range (`trimStartS`/`durationS`), delete the original, `PATCH` mutes/effects.
5. `render { draft: true }`; look at the draft with `frame`/`contact-sheet`; run `silences` on the draft asset to check the result.
6. Iterate, or `restore` the checkpoint; then the final `render`.

The reference implementations of exactly this live in `tests/eval/tasks/` and
run with `pnpm test:eval` against a running app (`BASE_URL` to point elsewhere,
`EVAL_WHISPER=1` to include the transcript task). They double as the scoring
harness for an agent: swap the reference solver for an MCP-driven one and keep
the scorers.
