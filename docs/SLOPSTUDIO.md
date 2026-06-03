# SlopStudio

SlopStudio is a browser-based, Premiere-style **non-linear video editor (NLE)** with
built-in AI generation. It began as a fork of the SpotForge campaign-video generator and
has been reworked into a floating-panel editing workspace: a draggable/resizable multi-track
timeline, a live canvas preview, generic audio/video tracks, a Media Bucket, and one-shot
AI video + voiceover generators.

> This document describes the **editor** (the SlopStudio NLE). The original generation
> pipeline, data model, ffmpeg internals, env vars, and production deploy are documented in
> [`../README.md`](../README.md) and [`../CLAUDE.md`](../CLAUDE.md). The 13-feature plan that
> kicked off the NLE work is in [`PREMIERE_ROADMAP.md`](PREMIERE_ROADMAP.md).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind 4 · pnpm ·
Node 22 · Prisma 6 + PostgreSQL · Zod 4 · Zustand 5 · react-rnd · argon2id sessions · ffmpeg.

## The Studio workspace

The editor (`/projects/[id]`) is a floating-window workspace ported from the sibling app
ShuttleDeck:

- **`studioWorkspaceStore`** (Zustand, `src/stores/studioWorkspaceStore.ts`) — window list,
  geometry, z-order, and persistence. Layouts are **per-user-global**, saved in the
  `WorkspaceLayout` table. There is **no auto-save**: a saved workspace is only overwritten on
  an explicit Save (so experimenting/testing can't clobber a layout). The workspace named
  **"Default Workspace"** is delete-protected.
- **`ProjectEditorProvider`** (React Context) — the per-project edit draft, the shared preview
  `engine` (`usePreviewEngine`), undo/redo (`useUndoable`), selection, and the handlers every
  panel reads via `useProjectEditor()`. The whole provider is keyed on `snapshot.updatedAt` so
  a fresh server state re-seeds the draft.
- **`PanelRegistry`** — lazy-loaded panels registered with a type/title/icon/group + min size.
  `WorkspaceShell` renders each as a `react-rnd` window with `PanelChrome` (a slim title bar;
  `bare` mode omits it, as the Timeline uses).
- **Toolbar** (`StudioToolbar`) — `← Videos`, a **File** menu (cost estimate, signed-in user,
  Users, Settings, Sign out), the centered project title (editable, Lora Bold), undo/redo,
  **+ Panel** launcher, **Arrange**, the **Workspaces** menu, **Save**, and **Render →**.

### Panels

| Panel | Group | What it does |
|-------|-------|--------------|
| **Program Monitor** | Viewer | Live canvas preview (Live) or the exact rendered MP4 (Rendered); grey transport + master volume. |
| **Video Edit** | Viewer | Source monitor — load a clip (drag from the bucket / "Open in Video Edit"), set In/Out with two triangle markers, drag the display onto the timeline as a trimmed subclip. |
| **Video Generator** | Edit | One-shot AI video: pick a model (cheapest first/default), an optional reference image (upload or drag a photo in), a prompt, and a length constrained to what the model supports. Output lands in the Media Bucket. |
| **Voiceover** | Audio | One-shot TTS: model + voice + script → an audio clip in the Media Bucket. |
| **Effects** | Edit | Per-clip keyframed Motion (scale/pan zoompan) + move-to-overlay (PiP). |
| **Text Overlays** | Finish | Burned-in lower-thirds / titles / disclaimers with timing, color, and a background box. |
| **Media Bucket** | Library | The project's media shelf — uploads, YouTube grabs, Browse (reuse from other projects), and **generated clips** (twinkle + live status + duration overlay). Drag/Add onto the timeline. |
| **Polish** | Finish | Color look, grain, vignette, transitions, watermark, final-mix options. |
| **Timeline** | Edit | The multi-track editor (below). |

## The timeline (`TimelineView`)

Tracks: **V1** (main contiguous video sequence) · **V2** (positioned PiP overlay) · **A1**
(clip audio: linked mirrors + audio clips) · **A2** (imported/overlay audio). One shared,
**drag-to-resize** track height (grab any divider). The empty toolbar stretch is the window
drag handle (the panel has no title bar).

- **Clips** — drag to reorder (dnd-kit), blade/**Split** at the playhead, **ripple-delete**,
  left/right edge **trim** (in/out points, snapping to boundaries + playhead), and per-clip
  Motion keyframes via Effects.
- **Audio clips** — selectable, deletable, draggable to reposition, and trimmable with
  left/right edge handles (`AudioClipBlock`).
- **Linked clip audio** — a video clip carries its own audio (`Segment.muted=false`), shown as
  a teal "🔗 audio" mirror under it. The **Unlink** toolbar button mutes the clip and drops an
  independent audio clip on the audio track that you can move/trim separately.
- **Playhead** synced to the preview clock; **spacebar** plays/pauses when the timeline window
  is focused.

## Render pipeline (one spec, two paths)

A single declarative **`RenderSpec`** (`src/lib/render/spec.ts`) describes a project's visuals
+ audio. Two consumers render it, and every feature must extend both:

1. **Live preview** — `usePreviewEngine` (rAF clock) + the Canvas2D compositor
   `src/lib/render/draw.ts` (`MediaCache` of video elements). Plays the active clip's audio,
   VO/music elements, and a pool of `<audio>` elements for audio-only clips. A master volume
   scales everything.
2. **Final export** — `src/lib/ffmpeg/assemble.ts` builds one big ffmpeg filtergraph (concat /
   xfade / overlay / drawtext / amix). This is the source of truth; the live preview is an
   approximation.

The shared `RenderSpec` keeps the two in sync (clip transforms, PiP, color, text, audio clips).

## Audio model

The old voiceover/music-bed concept was **fully torn down** — there's no VO/Music distinction.
Audio is just **audio clips** on audio tracks:

- A one-time migration converted every project's voiceover + music bed into audio-only clips,
  then removed the special fields' use (`audioMode=NONE`, no `VoiceoverAsset`/`musicAssetId`).
- New audio enters via **Upload**, **YouTube**, **Browse**, **Unlink** (split from a video
  clip), or the **Voiceover** generator.
- The deprecated `Project` audio columns and the TTS/music generation jobs remain inert in the
  schema/code, to be reworked alongside the other panels later.

## AI generation → the Media Bucket

AI video and voiceover **do not** land on the timeline. They become **library segments**
(`Segment.library = true`) — excluded from the timeline, preview, render, and render-blocker —
that surface in the **Media Bucket** with a ✨ "new" twinkle, a live "Generating…" → ready
state (the project store polls while AI shots generate), and a duration overlay. You drag/Add a
ready clip onto a track when you want it.

- `POST /api/projects/[id]/generate-clip` — creates an AI video library segment + enqueues the
  `SUBMIT_SHOT` job chain. Model duration options are constrained per family (Veo 4/6/8s,
  Kling 5/10s, Wan 5s, Seedance 4/5/6/8/10s) so a request can't error.
- `POST /api/projects/[id]/generate-voiceover` — synchronous TTS → an `UPLOAD_AUDIO` asset +
  an audio library segment.

## Data model notes (`Segment`)

The timeline/render behaviour keys off a few flags:

- `track` — 0 = V1 (contiguous), 1 = V2 (PiP overlay, positioned by `offsetS`).
- `audioOnly` — a clip's audio on an audio track (no video output), positioned by `offsetS`,
  trimmed by `trimStartS`/`durationS`.
- `library` — a generated clip living in the Media Bucket only (never timeline/render).
- `muted` — whether a video clip's own audio is mixed in (defaults **false** for uploaded
  video so clip audio comes along; AI clips/stills stay silent).
- `trimStartS` / `durationS` / `offsetS` / `speed` / `transform` (keyframes) / `pip`.

The project `save()` (PATCH) persists per-segment `track`/`offsetS`/`pip`/`transform`/
`audioOnly`/`muted`/trim — structural edits go through dedicated routes + `refetch()`.

## Branding

The camera-robot mascot is the logo (`public/logo.png`, shown in the toolbar + headers) and the
favicon (`src/app/favicon.ico` + `icon.png`). Backgrounds were removed with an edge-connected
flood fill so the camera's light-grey parts stay intact.

## Local development

See [`../README.md`](../README.md) for the full setup. In short:

```bash
scripts/pg.sh start        # user-owned Postgres on :5434 (no-sudo box)
pnpm db:migrate
pnpm dev                   # web (Next dev); set WORKER_ENABLED=true to run the job worker in-process
# or, in a second terminal: pnpm worker
```

Register at `/register` — the first account becomes ADMIN (admins can use the pricey video
models like Veo). Verification during development: `pnpm exec tsc --noEmit` + `pnpm lint`
always; local ffmpeg dry-runs for render-filter changes; `playwright-qa` for native-drag /
browser-physics behaviour.
