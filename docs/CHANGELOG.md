# Changelog

Notable changes, newest first. See [DEPENDENCIES.md](DEPENDENCIES.md) for setup and
[AUDIO_STUDIO.md](AUDIO_STUDIO.md) for the audio workspace.

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
