# Changelog

Notable changes, newest first. See [DEPENDENCIES.md](DEPENDENCIES.md) for setup and
[AUDIO_STUDIO.md](AUDIO_STUDIO.md) for the audio workspace.

## 2026-06 — Unified timeline, portable project bundles, start-screen redesign

### Unified timeline — video + audio on one multi-layer timeline ([TIMELINE.md](TIMELINE.md))
- **Waveforms on the video timeline's audio clips** — a reusable non-interactive
  WaveSurfer (`src/components/studio/Waveform.tsx`), drawn in a bright colour over a
  deepened-green clip so it reads clearly (a same-hue waveform was invisible).
- **Per-clip tempo + beat markers** — a ♩ button on each audio clip measures BPM via
  `/api/audio/analyze` (now accepts a DB `assetId`, not just a workspace `path`) and
  draws ▾ beat markers mapped through each clip's offset + left-trim.
- **Arbitrary N video + N audio layers.** `track` is now any layer index (cap raised
  1→31 in validation); `track >= 1` is a positioned video overlay. The timeline
  renders one lane per used track plus on-demand **+V / +A** lanes (defaults to one
  video + one audio). The preview (`spec.ts`) and ffmpeg renderer (`jobs/handlers.ts`,
  `ffmpeg/assemble.ts`) composite overlays bottom-to-top by track and **mix unmuted
  overlay-clip audio** (preview engine advances + sounds overlays to match the render).
- **Audio Studio ↔ Assembly bridge.** "→ Timeline" ingests a whole multitrack
  arrangement onto the video timeline (one audio layer per track, offset + trim
  preserved). Media Bucket audio can be dragged onto the multitrack timeline
  (`/api/audio/from-asset`). The Media Bucket is now a *shared* panel (survives the
  audio section's layout sanitize).

### Portable project bundles ([PROJECT_BUNDLES.md](PROJECT_BUNDLES.md))
- Projects can live as a **named folder** under a user-chosen base, holding a portable
  `project.json` manifest + an `assets/` tree (Premiere-style). New schema:
  `Project.bundlePath`, `User.defaultProjectFolder`.
- Storage is bundle-aware (`src/lib/assets/storage.ts`): writes land in
  `<bundle>/assets/<sub>` and store **absolute** paths; `absolutePath()` passes
  absolute paths through and still resolves+guards legacy `ASSET_ROOT`-relative ones.
- Electron native folder picker (`slop:pick-folder`/`reveal` IPC + preload bridge,
  typed via `src/lib/desktop.ts`); Settings → **Default project folder**; per-project
  override in the New Project popup. Existing projects are untouched (legacy path).

### Dashboard / start
- Dashboard renamed **"Your Projects"**, with single + batch **project delete**
  (soft-delete via `DELETE /api/projects/[id]`), and a split **+ New Video** /
  **+ New Audio Composition** action.
- **Start screen redesign:** the four options use transparent **Slop character**
  art (backgrounds removed via flood-fill / `rembg`), the **SLOP STUDIO PRO** marquee
  wordmark powers on like an old sign over the centered CinemaBot animation, and the
  option cards are intentionally **squishy** (spring hover, jelly icons, press-squish,
  staggered bounce-in, hover shine, idle bob). Card descriptions + Start/Browse labels
  removed for a tight, icon-first grid.

### UI chrome
- **Removed the top nav bar** (`AppHeader`) everywhere; a small fixed **Home button**
  (`src/components/HomeButton.tsx`) sits top-left on plain screens (hidden on
  home/login/editor; the editor's toolbar logo links home). API-key settings still
  live at `/settings` pending a new dedicated area.
- **Studio panels lost their title bars + corner icons** (`PanelChrome` renders just a
  draggable strip + Close).
- Media Bucket: **"Browse" → "Assets"**, icons/fonts ~30% smaller.

## 2026-06 — WebGL preview, Audio Studio, desktop self-containment

### WebGL (PixiJS) preview compositor — now the default
- Hybrid renderer (`src/lib/render/gl/`): PixiJS composites clip layers (color,
  keyframed transform, crossfade, V2 PiP overlays, blur-fill) on an offscreen WebGL
  canvas → drawn onto the visible 2D canvas → shared post pass (vignette/grain/
  watermark/text) on top. `pickCompositor()` defaults to GL; opt out with `?gl=0`.
  Canvas2D remains the automatic fallback (and the renderer if GL init fails).
- **All 7 effects preview live** (blur, pixelate, mirror, rotate, crop, chroma key,
  sharpen) — chroma key + sharpen are custom v8 GLSL filters; the rest are built-in
  filters / sprite geometry.
- Desktop fix: PixiJS uses `eval`, blocked by the Electron CSP → load
  `pixi.js/unsafe-eval` before creating the renderer.

### Effect correctness (preview ↔ export parity)
- **Crop** is now a *mask* crop (cut edges → black, no stretch) in both preview and
  ffmpeg export.
- **Geometry effects (crop/mirror/rotate) run before the transform**; filters
  (blur/chroma/…) after — so cropping a *shrunk* clip crops its content, not the
  padding. Fixes crop being a no-op when combined with Scale.
- **Effect filters are cached** per (clip, effect) instead of recreated every frame —
  chroma key on video no longer freezes playback.
- **Scale** now ranges 0.1×–4× (shrink as well as zoom), with pan working both ways;
  export uses scale+pad for constant shrink.

### Export experience
- The toolbar **"Render →" is now "Export →"** and opens a floating, borderless white
  window with cycling, occasionally-surprising status text, then reveals the finished
  video (`public/sloppyexport.mp4`) + a save link. Driven by a module store
  (`useExportStore`) rendered above the keyed StudioRoot remount so the render it fires
  can't kill the window.

### Audio Studio (new) — see [AUDIO_STUDIO.md](AUDIO_STUDIO.md)
- Fourth startup mode: a DAW-style audio workspace (import, visualizer, **Demucs** stem
  separation, multitrack, processing rack, audio tools, loudness meter).
- Fixed the workspace-preset plumbing: the `?ws` param is read **server-side** and
  passed down (a `useState` initializer dropped it across SSR); the async layout load
  no longer clobbers an applied preset on remount.

### Desktop / packaging
- **Bundled static ffmpeg+ffprobe** into the AppImage (`vendor/ffmpeg` via
  `scripts/fetch-ffmpeg.sh`) → self-contained, no host ffmpeg needed. Falls back to
  system ffmpeg on PATH when none is bundled.
- **Encoder probe fix:** `capabilities.ts` now probes the *resolved* ffmpeg (not bare
  PATH), so the bundled build (no VAAPI) correctly uses x264 software encode.
- The fork now has its **own dev database** (`slopstudio_pro`) + its own worker, so it
  no longer collides with the upstream SlopStudio on the job queue / asset dirs.

### UI
- Primary **buttons are neutral gray** (new `--color-control`) instead of the blue/
  violet accent; panel controls slimmed (`text-xs`, tighter padding).
- The `/start` logo is the animated **CinemaBot** (`public/cinemabot.webm`), playing
  once on load.

### Dependencies of note
- **`torchcodec`** is now required for Demucs (torchaudio ≥2.8 needs it to save audio).
- PixiJS + pixi-filters (WebGL), wavesurfer.js (audio). Full list in
  [DEPENDENCIES.md](DEPENDENCIES.md).
