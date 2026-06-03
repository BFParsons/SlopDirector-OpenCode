# WebGL (PixiJS) Preview Compositor — build plan

## Goal & why

Replace/augment the Canvas2D live-preview compositor (`src/lib/render/draw.ts`) with a **PixiJS v8 WebGL2 renderer** so the effect stack (#4, already shipped) previews **WYSIWYG** instead of showing "applied on export" badges, and so effect-heavy frames stay at 60fps. The ffmpeg **export already works** for every effect; this work is purely about **preview fidelity + speed**. It also makes precise PiP (#3) trivially free-transform and is the right base for a future WebCodecs decode path. It does **not** help stabilization (temporal two-pass — stays export-only).

## Locked decisions
- **PixiJS v8** (WebGL2). Add `pixi.js@^8` + `pixi-filters@^6` (built-in blur/pixelate/glow/color-matrix).
- **Flag-gated, Canvas2D kept as the fallback.** Default stays Canvas2D until GL reaches parity on the core looks; then flip the default. Instant revert if a shader regresses.
- **Hybrid:** PixiJS composites the *spatial/photometric* layers (clips + per-clip color/transform/effects + PiP) into a render texture; the cheap whole-frame post (vignette, grain, watermark `<img>`, `drawText`) stays **Canvas2D on top** (reuse existing code → zero text/watermark regressions, small parity surface).

## Current-state hooks (already in place from #3/#4)
- `RenderClip.effects: EffectSpec[]` exists (`src/lib/render/spec.ts`); the export consumes it via `effectsFfmpeg()` (`src/config/effects.ts`).
- The effect **registry** `src/config/effects.ts` already pairs each effect with its **ffmpeg** builder + `preview: "live" | "export"`. **The GL work adds a sibling `makePixiFilter(params)` to each `EffectDef`.** Effects flip from `preview:"export"` → `"live"` as their Pixi filter lands.
- PiP is **already center-based + de-clamped** (`pip.ts`/`draw.ts`/`assemble.ts`) — GL just renders that model.
- `draw.ts` `colorFilter()` + the `MediaCache` (lazy-windowed `<video>`/`<img>`, `crossOrigin="anonymous"`, served same-origin → **no texture taint**) are reused.
- The perf HUD (`?perf=1`, `src/lib/perf/registry.ts`) — extend to count GL textures (leak watch).

## Architecture: the `Compositor` seam

The engine's only call into rendering is `usePreviewEngine.draw()` → `drawFrame(ctx, spec, t, cache)`. Cut there:

```ts
// src/lib/render/compositor.ts (new)
export interface Compositor {
  mount(canvas: HTMLCanvasElement): Promise<void> | void;
  render(spec: RenderSpec, t: number, cache: MediaCache): void;
  resize(w: number, h: number): void;
  destroy(): void;
  readonly kind: "canvas2d" | "gl";
}
```
- `Canvas2DCompositor` — thin wrapper over today's `drawFrame` (instant fallback, zero behavior change).
- `GLCompositor` — PixiJS renderer (below).
- `pickCompositor()` chooses by `?gl=1`/`?gl=0` → `localStorage.slop_gl` → default. On GL `mount` failure (no WebGL2 / Pixi throw) → **auto-fallback to Canvas2D**.

`usePreviewEngine` change is surgical: a `compositorRef` instead of the inline ctx; `draw()` → `compositorRef.current?.render(...)`; `resize()` on spec-dim change. **`sync()`/`seek()`/audio/preload-window/perf — all unchanged.** Pixi `mount` is async → gate first `draw()` behind a `ready` flag (the existing `setTimeout(draw,40/60/180)` retries already tolerate a not-ready compositor).

## Render graph (`GLCompositor.render`)

Mirror `drawFrame` into an offscreen RenderTexture sized `spec.width × spec.height` (≤854w):
```
clear → black
1. clipsAt(spec,t) → {current, outgoing, mix}
2. outgoing (if any): ClipNode → draw at alpha=(1-mix)   [crossfade/dissolve]
   wipe/slide/fadeblack: a 2-input TransitionFilter(uCurrent,uPrev,uMix,uMode)
3. current: ClipNode → draw at alpha=(outgoing?mix:1)
4. overlays (V2): PiPNode each (center-based transform, blend=opacity)
→ renderer.render(stage → RT)
Canvas2D post (same visible canvas): drawImage(RT) → vignette, grain, watermark, drawText  (reuse draw.ts)
```
- **ClipNode** = Sprite(texture=video/img) in a Container carrying: fit geometry (`contain`/`cover`/blur-fill — extract to `render/fit.ts`, shared with Canvas2D), keyframed transform (`sampleTransform`, identical math), and a **filter chain** `[ColorMatrixFilter(look+adjust)] ++ effectFilters(clip.effects)`.
- **BLUR_FILL** = two sprites (cover+BlurFilter behind contain), matching `draw.ts`.
- Color looks → a `ColorMatrixFilter` derived to match `args.ts colorLookFilter` (new `render/colorMatrix.ts`); curves-preset looks (vintage etc.) are approximate — same as today's CSS approximation, so not a regression. Long-term: bake each look to a 3D LUT for true parity.

## Video → texture
- Reuse `MediaCache` elements. Per URL, one Pixi `Texture` over a `VideoSource{resource:videoEl, autoPlay:false, updateFPS:0}` (video) or `Texture.from(imgEl)` (image). **Pixi must not drive playback** — the engine's `sync()` owns it.
- Each rAF, before `render`, call `source.update()` only for the **visible** sources (current/outgoing/active overlays) — ≤3-4 uploads/frame. Guard with `readyState>=2` + `requestVideoFrameCallback` dirty-flag (skip unchanged/paused). Images upload once.
- `GLTextureCache` keyed by URL, **eviction driven by the existing preload window** (`MediaCache.activated`) — `.destroy()` textures leaving the window; never touch the `<video>` element. Keeps VRAM bounded like decode memory is today.
- AMD APU: WebGL2 + `texImage2D(<video>)` is fine on Mesa; RGBA8, no MSAA, RT capped at spec dims.

## Effects: Pixi filter ↔ ffmpeg (the payoff)
Add `makePixiFilter(params)` to each `EffectDef` in `src/config/effects.ts`, matched to the existing `ffmpeg` builder. Flip `preview` to `"live"` as each lands:

| Effect | Pixi filter (preview) | ffmpeg (export, already built) |
|---|---|---|
| blur | `BlurFilter{strength=sigma}` | `gblur=sigma=` |
| chroma key | custom `ChromaKeyFilter` (color+similarity+blend) | `chromakey=color:sim:blend` |
| crop | sprite frame/rect + rescale | `crop=…,scale=` |
| mirror | `scale.x/y = -1` | `hflip`/`vflip` |
| rotate | container `rotation` | `rotate=` |
| pixelate | `PixelateFilter{size}` | `scale down/up neighbor` |
| sharpen | custom unsharp `Filter` | `unsharp=` |
| glow (future) | `AdvancedBloomFilter` | `gblur`+screen blend |
| stabilize | **export-only** (badge) | `vidstabdetect`+`vidstabtransform` |

Match by tuning (e.g. Pixi blur `strength` ≈ ffmpeg `sigma`); lock with golden frames.

## PiP (#3) on GL
Already center-based + de-clamped. PiPNode: `anchor=0.5`, `container.position=(posX*W, posY*H)`, `scale = pipW/W`, `alpha=opacity`. No clip needed (Pixi overflows); rect mask only if a crop effect is present. Numeric UI already done.

## Golden-frame parity harness
`test/golden/` (opt-in `pnpm golden`, **no API spend**):
- **Fixtures generated locally** with ffmpeg (color bars / gradient / `testsrc`); a handful of `RenderSpec` JSON cases (one per look/effect/transition/PiP) at fixed `t`.
- **Export ref:** `assembleVideo` (local ffmpeg) → extract frame at `t`.
- **GL frame:** run `GLCompositor` headless in a Playwright Chromium page (real WebGL2 + video decode) → `readPixels`.
- **Diff:** mean-abs-error + max-region threshold (loose for stochastic grain — compare grain-off); emit side-by-side + diff PNGs. Per-case thresholds.
- Gate: "GL reaches parity" = the 9 color looks + crossfade + PiP cases pass.

## Phased build order (commit-sized, shippable each step)
1. **Extract `render/fit.ts`** (`contain`/`cover`/`kenBurns`/`posXY`) + `render/colorMatrix.ts` (per-look matrices). `draw.ts` imports them — no behavior change.
2. **`Compositor` interface + `Canvas2DCompositor`**; refactor `usePreviewEngine` through it. Default + only impl = Canvas2D. Pure refactor.
3. **Add PixiJS deps + `GLCompositor` skeleton** (base clip, contain-fit, no color/fx), behind `?gl=1`. Canvas2D default. (Experimental opt-in ships.)
4. **GL color + transform + outgoing/crossfade + blur-fill.** Wire `colorMatrix.ts`. Golden: looks + crossfade.
5. **Canvas2D post pass** (vignette/grain/watermark/text over the RT). Now GL ≈ Canvas2D for the whole current feature set.
6. **Transitions** wipe/slide/fadeblack (TransitionFilter) + golden.
7. **PiP on GL** + golden PiP cases. **Flip default to GL** once steps 4–7 golden cases pass; Canvas2D stays the instant fallback.
8. **Effect Pixi filters** (`makePixiFilter` per effect, flip `preview:"live"`), incrementally: blur → mirror/rotate/crop/pixelate → chroma key → glow. Per-effect golden + remove the "on export" badge as each lands.

## New files
`render/compositor.ts`, `render/canvas2dCompositor.ts`, `render/gl/GLCompositor.ts`, `render/gl/ClipNode.ts`, `render/gl/PiPNode.ts`, `render/gl/textures.ts`, `render/gl/transitions.ts`, `render/gl/post2d.ts`, `render/fit.ts`, `render/colorMatrix.ts`, `test/golden/run.ts` + fixtures.

## Edited files
`usePreviewEngine.ts` (compositor seam), `draw.ts` (export geometry/post helpers for reuse), `config/effects.ts` (add `makePixiFilter` per effect; flip `preview`), `pip.ts`/`EffectControlsPanel.tsx` (already center-based — minor), `perf/registry.ts` (count GL textures), `package.json` (pixi deps + `golden` script).

## Top risks & mitigations
- **Color-look parity (highest):** curves-preset looks can't be an exact matrix → match dominant eq/colorbalance terms; per-look golden thresholds; LUT bake later. (Not a regression — CSS path is also approximate.)
- **APU decode/upload stalls:** `updateFPS:0` + visible-only `update()` + rVFC dirty-flag; RT capped; never upload paused frames.
- **Pixi async init vs sync `draw()`:** `ready` flag + existing retries + auto-fallback on mount failure.
- **Texture/VRAM leaks:** `GLTextureCache` eviction on the preload window; HUD texture count.
- **Transition easing:** xfade `fade` is linear in mix → match linear; mid-transition golden frame.
- **Premultiplied-alpha / colorspace** in golden readback vs ffmpeg yuv→rgb: compare in same space + small tolerance for chroma subsampling.

## Verification each phase
`pnpm exec tsc --noEmit` + `pnpm lint` always; `pnpm golden` (local ffmpeg + headless Pixi) for parity; Playwright smoke that `?gl=1` renders without console errors + the perf HUD shows GL active and stable texture count; **never** click Generate/Render (no API spend).
