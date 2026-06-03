# SpotForge — Tier B Spec (toward a real editor)

> Tier A (shipped 2026-05-29) added declarative, batch-rendered editor features:
> blur-fill, vignette, grain, per-segment brightness/contrast/saturation,
> expanded color looks, master audio fades, logo/watermark, and burned-in text
> overlays. All of it is "free" on the box because it's just more nodes in the
> single `ffmpeg -filter_complex` graph built by `src/lib/ffmpeg/assemble.ts`.
>
> Tier B is the set of features that the current **declarative batch-render**
> architecture can't give you for free. Each item below states the architectural
> change, the data model, the server impact on the CPX31 (8 GB / 4 vCPU /
> 160 GB, `MAX_CONCURRENT_ASSEMBLY=1`), and a build estimate.

The guiding principle from the Tier A analysis still holds:

**Feature breadth is cheap (filter graph). Interactivity is expensive — and the
right place to pay for it is the browser, not the box.**

Recommended sequence: **B1 → B2 → B3 → B4**. B1 unlocks the "feels like an
editor" perception with the least server risk; B3/B4 are larger and build on the
multi-layer model B1 introduces in the client.

---

## B1 — Real-time WYSIWYG preview (client-side compositor)

**The flagship.** Today the "preview" is stacked HTML5 `<video>`/`<img>` blocks
(`TimelineView.tsx`); the true composite only exists after a server render. B1
makes the browser draw the composite live so editing feels immediate.

### Architecture

- Build a **client-side compositor** that renders the timeline to a `<canvas>`
  at preview quality (e.g. 640×360), driven by a JS clock.
- Reuse the **same declarative spec** that `assembleVideo` consumes. Extract the
  segment/overlay/polish model into a shared, framework-agnostic `RenderSpec`
  (a plain TS type in `src/lib/render/spec.ts`) that BOTH:
  - the browser compositor interprets for preview, and
  - `serialize`/`handlers` translate into ffmpeg args for the final export.
  This "one spec, two renderers" split is the core of B1 — the export stays
  authoritative; the preview is an approximation that must visually agree.
- **Compositor tech:** Canvas2D + `requestVideoFrameCallback` for the MVP
  (decode each segment's `<video>`/`<img>`, draw with the current transform,
  paint overlays/text on top). Upgrade path: WebGL/WebCodecs for smooth scrub of
  multiple layers. WebCodecs `VideoDecoder` gives frame-accurate seeking the
  `<video>` element can't.
- **Effect parity:** re-implement the Tier A looks as canvas/WebGL ops
  (brightness/contrast/saturation = trivial; color looks = LUT or shader;
  vignette/grain = shader/overlay; blur-fill = a downscaled blurred draw behind
  the fit draw; drawtext = canvas `fillText`; watermark = `drawImage`). Keep a
  single source of truth for the look parameters so preview ≈ export.

### Server impact

**Near zero.** All preview work is in the user's browser. The box still only
runs ffmpeg for the final export. This is the entire point — do NOT add
server-side proxy renders (with `MAX_CONCURRENT_ASSEMBLY=1`, one scrubbing user
would monopolize the encoder).

### Data model

None required for the MVP. Optionally add `Project.previewSpecVersion` to bust a
client cache when the spec schema changes.

### Effort

Large front-end build (the compositor is real work), but **isolated** — it
doesn't touch the render queue, auth, or the export path. Phase it:
1. `RenderSpec` extraction + a canvas that draws static frames at a scrubber
   position (no playback). Already useful — instant visual feedback per edit.
2. Playback clock + audio preview (`WebAudio` mixing the VO/music/overlays).
3. Effect parity pass (looks, vignette, grain, blur-fill, text, watermark).
4. WebCodecs upgrade for smooth multi-layer scrub.

### Risks / watch-items

- **Preview-vs-export drift.** Color math and font metrics differ between
  canvas and ffmpeg. Mitigate with a golden-frame test: render the same spec
  both ways at a few timestamps and diff. Accept "close enough"; label the
  preview as an approximation.
- Memory: decoding several HD `<video>`s in a 15 GB-ish laptop browser is fine;
  keep preview resolution low and release decoders for off-screen segments.

---

## B2 — Auto-captions / subtitles (speech-to-text)

High value for political ads (sound-off social autoplay). Fits the existing job
queue cleanly.

### Architecture

- New `JobType.TRANSCRIBE` + handler. Two implementation options:
  - **Local `whisper.cpp`** (base/small model). On CPU it runs ~5–10× realtime
    for short ad clips, so a 60 s ad transcribes in seconds. Adds a binary +
    model file to the image (~150 MB for `small`). No per-use API cost.
  - **API STT** (offload to a provider). Zero box footprint, per-minute cost,
    one more external dependency.
  Recommendation: start with the API for speed-to-ship, swap in whisper.cpp if
  cost or privacy matters.
- Transcribe the **VO asset** (already on disk as `VoiceoverAsset.asset`) →
  produce word/segment timings → store as a caption track.
- **Burn-in reuses Tier A.** Convert caption cues into timed `TextOverlay`-style
  draws, OR emit an ASS subtitle file and add a `subtitles=` filter in
  `assemble.ts`. ASS is better for many short cues (one filter vs. N drawtexts).

### Data model

```prisma
model CaptionTrack {
  id        String   @id @default(cuid())
  projectId String   @unique
  project   Project  @relation(...)
  cues      Json     // [{ startS, endS, text }]
  style     Json?    // font size, position, box — defaults to lower-third
  burnIn    Boolean  @default(true)
  status    SimpleStatus @default(PENDING)
}
```

### Server impact

Moderate. A transcription job is CPU-bound but short and **separate from
assembly** — cap it like downloads (reuse the `activeDownloads`-style gate). If
using whisper.cpp, it competes with assembly for cores; serialize it so it
doesn't overlap a render.

### Effort

Medium. The transcribe job + a caption editor (review/fix cue text and timing)
+ the ASS burn-in path. The editor matters — raw STT always needs a human pass.

---

## B3 — Keyframed animation

Animate position/scale/opacity/rotation of overlays (and eventually segments)
over time — e.g. a logo that slides in, text that pushes up, a Ken-Burns move
authored by hand instead of presets.

### Architecture

- Generalize the overlay model from static props to **keyframe tracks**: a
  property is either a constant or a list of `{ t, value, easing }`.
- **Preview (B1 compositor):** trivial — interpolate per frame on the canvas.
  This is exactly why B1 comes first; keyframes are painful in ffmpeg but natural
  in a per-frame canvas renderer.
- **Export (ffmpeg):** harder. Options, worst-to-best:
  - drawtext/overlay with `x`/`y`/`alpha` **expressions** of `t` (works for
    linear moves, gets unreadable fast).
  - Pre-render the animated overlay layer to a transparent **PNG sequence or a
    WebM/MOV with alpha** in a first pass (driven by the same interpolation code
    as the preview), then `overlay` that layer in the main graph. This makes the
    export use the SAME interpolation as the preview — exact parity — at the
    cost of a two-pass render. **Recommended.**

### Data model

Replace flat overlay props with a `keyframes Json` per animatable property, or a
sibling `Keyframe` table. Keep flat props as the "single keyframe" degenerate
case for backward compatibility.

### Server impact

The two-pass export adds one extra ffmpeg pass per project with animated layers.
Still one project at a time; just longer. Acceptable at this volume.

### Effort

Medium-large, and **depends on B1** (you want the compositor to author and see
the curves). Ship the preview/authoring first, then the two-pass export.

---

## B4 — Multi-track timeline (B-roll, PiP, layered overlays)

The current model is a **sequence** of segments concatenated end-to-end (see the
`concat`/`xfade` in `assemble.ts`). B4 makes the timeline **layered**: a base
track plus overlay tracks that occupy time *and* screen space simultaneously —
picture-in-picture, B-roll over A-roll, lower-third video bugs.

### Architecture

- Introduce a **track** abstraction. `Segment` gains `track: Int` (0 = base) and
  `startS` (absolute timeline position) instead of pure ordering. Overlay tracks
  also carry a **rectangle** (x/y/w/h or a 9-grid + scale) and z-order.
- **Export:** the filter graph stops being a linear concat. The base track is
  built as today; each overlay track is scaled/positioned and `overlay`-ed onto
  the running composite at its time window (`overlay=...:enable='between(t,a,b)'`).
  Audio from each track mixes via the existing `amix` machinery (already proven
  with unmuted-clip audio + overlays). This is a **significant rewrite of
  `assemble.ts`** — the biggest single change in Tier B.
- **Preview:** the B1 compositor already draws layers; multi-track is mostly a
  data/UX change there, not a new rendering capability. (Another reason B1
  precedes B4.)
- PiP is then just "an overlay track with a small rectangle." No separate
  feature — it falls out of B4.

### Data model

```prisma
model Segment {
  // ...existing...
  track   Int    @default(0)   // 0 = base; >0 = overlay layers
  startS  Float  @default(0)    // absolute timeline position (replaces pure index ordering)
  // overlay-track geometry (ignored on the base track)
  layoutX Float? // 0..1 of frame width  (top-left)
  layoutY Float?
  layoutW Float? // 0..1 of frame width
  zIndex  Int    @default(0)
}
```

Keep `index` for stable per-track ordering; derive timeline math from `track` +
`startS` + `durationS`.

### Server impact

Per render: more filter nodes (one `overlay` per overlay-track segment) and more
decoders open at once during encode → **higher peak RAM**. On 8 GB this caps how
many simultaneous overlay layers are sane (~3–4 HD layers). Add a validation cap
and `log()` it. Still one render at a time.

### Effort

Large. The `assemble.ts` rewrite is the hard part and must preserve every Tier A
behavior (transitions, audio mixing, fades, watermark, text). Gate it behind
golden-frame tests against the current linear output for single-track projects so
the rewrite is provably non-regressive.

---

## What stays off the box entirely

These are explicitly **not** Tier B on this hardware — they need a GPU or
horizontal scale, and the honest answer is "offload or upgrade," not "build here":

- **GPU AI effects** (background removal / rotoscoping / style transfer / real-time
  HD effect scrub) — no GPU on a CPX31. Offload to an API.
- **Many concurrent heavy renders** — `MAX_CONCURRENT_ASSEMBLY=1`. Scaling
  throughput means horizontal render workers or a bigger box, not feature work.
- **4K at volume** — possible but slow (x264 medium 4K is minutes/clip); bump the
  box first.

## Cross-cutting: asset retention

A richer editor accumulates media fast (AI clips + YouTube imports + renders +,
soon, caption/overlay artifacts) against a **160 GB** disk. Before B-series usage
grows, add a real retention policy (the `CLEANUP` job currently only sweeps
soft-deleted projects after 30 days). Consider per-user storage quotas and
pruning superseded renders/clips.
```
