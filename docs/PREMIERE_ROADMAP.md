# SlopStudio — Premiere-inspired roadmap

Goal: grow the floating-panel Studio into a genuine NLE for AI-generated political
campaign video. Premiere is the reference; the bias is toward what this product can
do that Premiere can't (script + VO already generated, AI image/video gen in-panel,
a GPU-equipped desktop host).

**Architectural anchors (don't break these):**
- `RenderSpec` (`src/lib/render/spec.ts`) is the single shared model the live preview
  and the export both read.
- The **browser canvas compositor** (`src/lib/render/draw.ts` + `usePreviewEngine`)
  draws the live preview; **ffmpeg** (`src/lib/ffmpeg/assemble.ts`) stays the
  authoritative final render. Every feature must extend *both* paths.
- Per-project edit state lives in `ProjectEditorProvider`; window layout in
  `studioWorkspaceStore`. New panels register in `src/components/studio/PanelRegistry.ts`.
- Effort is relative T-shirt sizing (S/M/L/XL), not time.

---

## Phase 1 — Make the timeline a real editor (foundation)

Everything else assumes a real editing surface and a safety net. Build this first.

### 1.1 Editable NLE timeline — *Premiere Timeline tools* · **L**
Blade/razor (split at playhead), drag trim-handles on clip edges, ripple delete,
snapping, drag-reorder within a lane, and **multiple video tracks (V1/V2…)** for
B-roll / picture-in-picture over the VO.
*Fits:* `RenderSpec` clips already carry start/dur/trim; add `track` index + z-order;
the compositor already layers (watermark/text), so PiP is the same overlay path. ffmpeg
gets a second `overlay` chain per upper track.
*Deps:* none. *Unlocks:* 1.2, 4.x.

### 1.2 Effect Controls + keyframes — *Premiere Effect Controls* · **L**
Per-clip Motion animated over time: Position, Scale, Rotation, Opacity, Crop, with a
keyframe track scrubbed from the playhead. Generalizes today's single Ken-Burns preset
into push-ins, pans, reframes, fades.
*Fits:* compositor already does Ken Burns — replace the static preset with interpolated
`[{t,value}]` tracks; export emits ffmpeg `zoompan`/`overlay`/`fade` expressions.
*Deps:* 1.1 (playhead/selection), benefits from 1.5.

### 1.3 History / undo-redo — *Premiere History panel* · **M**
Undo/redo stack over the draft. Editing without it is painful the moment 1.1 lands.
*Fits:* wrap `ProjectEditorProvider`'s draft mutations in a command/snapshot stack;
keyboard `Cmd/Ctrl+Z` / `Shift+Z`.
*Deps:* none; do alongside 1.1.

---

## Phase 2 — Look & sound (per-clip craft)

### 2.1 Lumetri Color + Scopes — *Premiere Lumetri Color & Scopes* · **L**
Real grade (Temperature/Tint, Shadows/Mids/Highlights, Saturation, Curves) replacing
flat look presets, plus a **Scopes** panel (Waveform / Vectorscope / Histogram) reading
the preview canvas.
*Fits:* compositor already applies per-clip CSS filters — widen to a grade struct;
scopes are pixel reads off the existing canvas; export maps to ffmpeg `eq`/`curves`/`colorbalance`.
*Deps:* none (presets remain as one-click starting points).

### 2.2 Essential Sound / Audio Mixer — *Premiere Audio Mixer & Essential Sound* · **M**
Per-track faders + solo/mute (VO/Music/SFX), **auto-duck music under VO**, and a live
**LUFS meter** so the ad hits social/broadcast spec. Consolidates today's scattered
musicVolume/ducking/normalize knobs.
*Fits:* values already flow to the ffmpeg mix (`sidechaincompress`/`loudnorm`); mostly a
real mixer UI + a meter tap on the preview's WebAudio graph.
*Deps:* benefits from 1.1 multi-track audio.

### 2.3 Effects & Transitions browser + Adjustment Layers — *Premiere Effects panel + Adjustment Layer* · **L**
A draggable library of video/audio effects & transitions applied per-cut on the timeline,
plus an **adjustment layer** (a clip on an upper track) that applies a grade/grain/look
across the *span* it covers.
*Fits:* effects become a typed list on a clip (and on a layer the compositor evaluates
top-down); reuses 2.1's grade + existing transition/grain code.
*Deps:* 1.1 (timeline drag targets), pairs with 2.1.

---

## Phase 3 — Graphics, captions & ingest

### 3.1 Graphics & Captions — *Premiere Essential Graphics + Text/Captions* · **L**
Animated title templates (lower-thirds / candidate supers / stat call-outs / one-click
**"Paid for by…"** disclaimer with safe-area), **and auto-captions generated from the VO
script already in hand** — burned-in or sidecar, essential for muted social autoplay.
*Fits:* text overlays already render in the compositor and ffmpeg `drawtext`/`ass`; add
animation presets + a caption track derived from script/VO timing.
*Deps:* none; captions are the fastest high-ROI win in the whole roadmap.

### 3.2 Source Monitor + three-point editing — *Premiere Source Monitor* · **M**
Preview any clip (AI shot / upload / YouTube grab) in a Source monitor, mark In/Out, and
**Insert/Overwrite** into the timeline at the playhead. Makes the Media Bucket + YouTube
Importer genuinely useful.
*Fits:* a second `usePreviewEngine` instance over a single-clip spec; insert/overwrite are
timeline ops from 1.1. *Deps:* 1.1.

### 3.3 Text-Based Editing — *Premiere Text-Based Editing* · **XL**
Edit the cut by editing the transcript: delete a sentence → the matching span lifts out;
reorder paragraphs → clips reorder. The AI-native flagship.
*Fits:* rides on 3.1's word-level caption timing mapped back to clip/VO ranges; edits emit
the same timeline ops as 1.1. *Deps:* 3.1 (timing), 1.1 (ops).

---

## Phase 4 — Advanced motion & delivery

### 4.1 Time Remapping — *Premiere Time Remapping* · **M**
Keyframed variable speed: slow-mo emphasis, speed ramps, **freeze-frame**.
*Fits:* a speed keyframe track on the clip; preview samples source time accordingly,
export uses ffmpeg `setpts`/`minterpolate`. *Deps:* 1.2 (keyframe infra).

### 4.2 Masking & Motion Tracking — *Premiere mask + track* · **XL**
Draw a mask, **track** it across frames to blur a face, redact a sign, or spotlight a
subject. Legally/ethically important for real footage in political content.
*Fits:* mask shapes per clip in the compositor (clip + feather + blur); tracking can start
manual-keyframe (1.2) then optionally a local CV/GPU tracker on the desktop host.
*Deps:* 1.2; great fit for the GPU-equipped desktop.

### 4.3 Auto Reframe + multi-aspect delivery — *Premiere Auto Reframe* · **L**
One master cut → auto **9:16 / 1:1 / 16:9** with subject-aware reframing; ship every
platform from one edit.
*Fits:* per-aspect reframe offsets in the `RenderSpec`; subject detection runs on the
desktop GPU; export loops the platforms. *Deps:* 1.2 (reframe = position/scale), 4.5.

### 4.4 Export presets / Media Encoder — *Premiere Export & Media Encoder* · **M**
One-click platform presets (TikTok 9:16, Reels, YouTube 16:9, broadcast) with per-platform
codec/bitrate/loudness, and a small queue.
*Fits:* preset → ffmpeg arg sets over the existing assemble pipeline. *Deps:* pairs with 4.3.

### 4.5 Proxies / preview-render cache (GPU) — *Premiere proxies + render bar* · **L**
Background-render heavy spans to a cache for smooth scrubbing (the red/yellow/green render
bar), using the local GPU encoders already probed at startup.
*Fits:* extends the capability-detection + hardware-encode work already in the project;
cache keyed by clip+effects hash. *Deps:* benefits everything once effects stack up.

---

## Recommended build order

1. **1.1 timeline → 1.3 undo → 1.2 keyframes** (the editing foundation)
2. **3.1 Graphics & Captions** (captions first — fastest high-ROI win)
3. **2.1 Color+Scopes → 2.2 Audio mixer → 2.3 Effects/Adjustment layers**
4. **3.2 Source monitor → 3.3 Text-based editing**
5. **4.1 remapping → 4.5 proxies → 4.3 reframe → 4.4 export presets → 4.2 mask/track**

Each item ships behind the same gates as the panel work: extends both the canvas preview
and the ffmpeg export, tsc + lint clean, a playwright smoke pass, one commit.
