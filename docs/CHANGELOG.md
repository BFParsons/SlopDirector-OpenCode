# Changelog

Notable changes, newest first. See [DEPENDENCIES.md](DEPENDENCIES.md) for setup and
[AUDIO_STUDIO.md](AUDIO_STUDIO.md) for the audio workspace.

## 2026-09 — no-storyboard fork

- **Dependency audit + upgrades** (see [UPGRADES-2026-09.md](UPGRADES-2026-09.md) for the
  full table and the feature opportunities). Electron 33 → **44** (Chromium 152, Node 24),
  electron-builder 25 → 26, Next 16.2.6 → **16.3.4** (security), React 19.2.8, PixiJS 8.20,
  and all other minors; same-major security floors in `pnpm-workspace.yaml` take
  `pnpm audit` from 2 critical / 44 high to **zero**. Held: Prisma 7, TypeScript 7,
  ESLint 10 (Next's React plugin isn't ready). The AppImage's bundled ffmpeg moves from a
  2024 static 7.0.2 (no VAAPI) to **BtbN's 9.0 build** with VAAPI/QSV/Vulkan, libplacebo,
  x265, SVT-AV1, vidstab, rubberband and libass (`scripts/fetch-ffmpeg.sh`), so the
  packaged app gets hardware export too.

- **Assembly dialog: New / Open + any frame size.** The Assembly card's dialog now has
  two tabs. *New project* offers a dropdown of popular sizes by medium — YouTube/web
  16:9 up to 4K UHD, DCI 2K/4K, vertical 9:16 up to 4K, square, 4:5 portrait, ultrawide,
  4:3 — plus width × height inputs for a custom size (even pixels, up to 4320 per side).
  *Open project* lists your projects (search, frame size, status; audio compositions open
  in the Audio Studio) and replaces the "Open project" card, so the start screen is
  Assembly + Audio Studio. New `Project.frameWidth`/`frameHeight` (Postgres migration
  `20260908140000_custom_frame_size`; SQLite forward-migration in bootstrap) override the
  aspect/resolution preset in `frameSize()` (`src/config/frame-sizes.ts`) for both the
  live preview and the final render; aspect/resolution are kept as the closest presets
  for AI video providers.

- **Storyboard mode removed.** Gone: the `/storyboard/[id]` board (`StoryboardWorkspace`),
  the start-screen card, the Visual panel's "Generate storyboard (AI)" button, the
  `generate-storyboard` API and `GEN_STORYBOARD` job, the storyboard LLM prompt/schema,
  the story-element APIs (`/elements`, segment element refs), keyframe image generation
  (`/images` API, `GEN_IMAGE` job, `src/lib/images` provider seam, image-model catalogue),
  and the fal.ai key setting + `FAL_*` / `IMAGE_PROVIDER` env vars.
- **Kept:** single AI shots (Visual panel → AI, Video Generator panel), script + voiceover
  generation (`GEN_SCRIPT`), and all editing/audio features.
- **Schema unchanged** on purpose (no migration): `StoryElement*` tables, `Project.concept`
  / `imageModel` / `visualGenStatus`, `User.falKey*`, and the `GEN_STORYBOARD` /
  `GEN_IMAGE` enum values remain; those job types now fail loudly if ever queued.

## 2026-09 — Omarchy (Arch + Hyprland) dev setup

- **Dev box moved to Omarchy.** Repo ported to run on Arch/Hyprland; details in
  [DEPENDENCIES.md → Omarchy / Arch Linux setup](DEPENDENCIES.md#omarchy--arch-linux-setup-desktop-target-dev-no-postgres).
- **`mise.toml`** pins Node 22 + pnpm 10.33.0. Node 26 breaks Electron's postinstall
  (binary never unpacks → "Electron failed to install correctly").
- **Dev runs the desktop target on SQLite** (`SLOPSTUDIO_DB=sqlite`, `SLOPSTUDIO_DESKTOP=1`
  in `.env`) — no Postgres server required for local work.
- **`scripts/pg.sh`** auto-detects the Postgres binaries (Arch `/usr/bin` or Debian
  `/usr/lib/postgresql/<ver>/bin`), gains an `init` step (cluster + role +
  `slopstudio_pro` DB), and its `psql` shortcut targets `slopstudio_pro`.
- **`scripts/launch-desktop.sh`** — Linux port of the PowerShell launcher, plus an XDG
  `.desktop` entry so **SlopStudio Pro** shows in the app menu.
- **Start screen fits short displays.** The hero (CinemaBot + marquee logo) now flexes
  into whatever height is left above the option cards (capped at its 28rem design
  size) instead of a fixed 28rem that pushed the cards below the fold on a 1080p
  laptop at 2x scale (~936×490 CSS px). Cards are four-across from `md` up and use a
  new Tailwind `short:` variant (`max-height: 640px`) for tighter padding/icons.
- **Electron window fits tiling compositors.** The default size now follows the
  display work area (`screen.getPrimaryDisplay()`), and the *minimum* dropped from
  1024×640 to 480×320. On Hyprland the tile can be smaller than the declared minimum;
  Chromium then renders at the minimum and the compositor crops the surface, which is
  why the bottom/right of the UI was cut off on a 960×540 logical screen.
- **Studio panels fit small displays.** Panel *minimum* sizes (now in one place,
  `src/config/panel-min-sizes.ts`, shared by PanelRegistry and the layout math) were
  roughly halved (e.g. Monitor 480×320 → 280×180, Timeline 560×220 → 320×140) so a
  full layout fits a ~936×411 workspace. The system video default and the Audio
  Studio default are now **proportional** to the live workspace instead of fixed
  pixels tuned for 1366- and 2100-wide screens (which put the Audio Studio's right-hand
  panels off-screen on a laptop). New `fitLayoutToContainer` (window-utils) scales a
  layout by the `container` size it was authored at (a new optional field stamped on
  every save) and clamps everything on-screen; it runs on load, on preset/reset, and
  whenever the workspace container resizes (e.g. the Hyprland tile changes). Legacy
  layouts without `container` are clamped only. The defaults allocate side columns and
  rows no smaller than their panels' minimums (the flexible centre absorbs the rest), so
  the seven-panel Audio Studio fits a laptop workspace without spilling off-screen.
- **Compact density on short viewports.** Under 640px tall the root font-size drops to
  13px, which shrinks Tailwind's rem-based type/spacing (button + select labels, paddings,
  toolbar) ~19% app-wide. Plus targeted trims: button labels never wrap (`Button` base +
  the toolbar menus — a wrapped "+ Panel" used to double the toolbar height), the toolbar
  title shrinks first, the Visual panel's add-media tiles become icon+label pills on
  short screens, form `Label` hints move into tooltips, and Next's dev badge is off
  (`devIndicators: false`).
- **Electron: reload/close no longer silently ignored.** The editor's `beforeunload`
  guard (unsaved/unnamed project) made Electron cancel reloads, navigations and window
  closes with no prompt at all. `electron/main.js` now handles `will-prevent-unload` by
  handing the blocked close/reload to the page (`slop:unload-blocked` → the in-app
  "Save this project?" dialog via `useLeaveGuard`), which then finishes the action with
  its guard bypassed (`slop:unload-action`). No native modal: a `showMessageBoxSync`
  blocked the main process and, on Hyprland, could land on another workspace where it
  couldn't be dismissed.
- **Narrow windows.** Below the `md` breakpoint (a half-width Hyprland tile) the
  toolbar collapses button labels to icons and hides the title so it fits without
  overlapping itself. Container resizes re-fit the layout from the last loaded/applied
  arrangement (`fitBase`), so shrinking a window and growing it back restores the
  layout exactly even when panels were pinned at their minimums in between.
- **New startup workspace (Assembly).** The system default is now three panels:
  Program Monitor across the top of the main area, Timeline below it, Media Bucket as a
  full-height column on the right (`studio-default-layout.ts`). Everything else is
  available from "+ Panel".
- **Toolbar menus fit the window.** The "+ Panel", Workspace and File dropdowns are
  capped to the viewport height and scroll past it; on short screens the panel launcher
  becomes two columns (Audio on the right) so all 18 panels show without scrolling.
- **`.npmrc`**: removed the Windows-only `script-shell` line (broke all pnpm scripts on
  Linux); Windows devs set it in their user-level `.npmrc`.

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
