# Unified Timeline

The video timeline (Assembly) and the Audio Studio's multitrack timeline are one
integrated, multi-layer surface: video clips and audio clips with waveforms,
trim/split, tempo/beat tools, and an arbitrary number of stacked layers — all
feeding one preview and one ffmpeg render.

Primary files: `src/components/TimelineView.tsx` (the timeline UI),
`src/lib/render/spec.ts` (preview spec), `src/components/timeline/usePreviewEngine.ts`
(preview playback), `src/lib/jobs/handlers.ts` + `src/lib/ffmpeg/assemble.ts` (render).

## Layers

A `Segment`'s `track` is its **layer index within its kind** (video vs audio,
disambiguated by `audioOnly`):

- **Video:** `track 0` = **V1**, the contiguous main sequence. `track >= 1` = a
  positioned overlay layer (V2, V3, …) placed by `offsetS`, composited
  **bottom-to-top by track index** as picture-in-picture.
- **Audio:** every `audioOnly` segment sits on an audio layer by `track`
  (**A1, A2, …**), positioned by `offsetS`. Audio is summed, so audio mixing is
  inherently track-agnostic. A1 (track 0) also shows linked clip-audio mirrors.

The validation cap on `track` was raised `1 → 31` (both create + patch schemas in
`src/lib/validation/project.ts`). No DB migration was needed — `track` was already
an `Int`.

### Lanes UI

`TimelineView` starts minimal — **one video lane (V1) + one audio lane (A1)** plus
an imports lane — and grows on demand:

- A used track always shows its lane.
- **+V / +A** toolbar buttons reveal an extra empty lane (`videoExtra`/`audioExtra`
  state) to drop onto. Dropping media on a lane assigns that `track`.
- `laneDropProps(kind, track)` handles drops; audio lanes accept audio only.

## Audio clip features

- **Waveforms** — `src/components/studio/Waveform.tsx` is a reusable, non-interactive
  WaveSurfer that fills its parent. On a timeline audio clip it's drawn in a bright
  near-white colour over a deepened-green clip body (a same-hue waveform read as blank).
- **Tempo + beats** — a ♩ button on each clip calls `POST /api/audio/analyze`, which
  now accepts a **DB `assetId`** (video-timeline clips are DB assets) in addition to a
  workspace `path`. Detected BPM shows on the button; beat times render as ▾ markers,
  mapped to timeline time through each clip's `offsetS` and `trimStartS`.

## Preview ↔ render parity

`buildRenderSpec()` (`spec.ts`) and the ffmpeg assembler share the same model:

- **Overlays** (`track >= 1`) are sorted by `(track, offsetS)` so array order = z-order
  (bottom→top) in both the canvas/WebGL preview (`draw.ts`) and ffmpeg
  (`assemble.ts` chains `overlay` filters per PiP clip).
- **Overlay-clip audio** is mixed when a clip is unmuted — both in the render
  (`assemble.ts` adds an `adelay`+`atrim` mix input per unmuted overlay) and the
  preview (`usePreviewEngine.ts` advances + sounds active overlay media elements, which
  were previously a frozen, silent first frame).
- Audio-only clips and YouTube/foreground overlays are mixed via `amix`.

## Audio Studio ↔ Assembly bridge

- **Send arrangement → timeline.** The Multitrack panel's **→ Timeline** button
  (`AudioMultitrackPanel.tsx`) ingests every track as an `audioOnly` segment on its own
  audio layer, preserving `offsetS` + trim, via `insertAudioFromStudio()` (which
  registers each workspace file as a DB Asset through `/api/audio/to-asset`).
- **Bucket → multitrack.** Dragging a Media Bucket audio asset onto the multitrack
  timeline bridges it into the Audio Studio workspace (`/api/audio/from-asset`) and
  adds it as a track. The Media Bucket is a **shared panel** (`SHARED_PANELS` in
  `src/config/studio-presets.ts`) so it can sit in the Audio Studio alongside the
  multitrack without being stripped by the section layout sanitize.
