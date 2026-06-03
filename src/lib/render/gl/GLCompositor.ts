/**
 * WebGL (PixiJS) preview compositor — hybrid architecture.
 *
 * PixiJS composites the clip layers (outgoing + current, crossfaded, each with
 * its color grade, keyframed transform, effect stack, and — in BLUR_FILL mode —
 * a blurred cover background) onto an **offscreen** WebGL canvas. Each frame that
 * result is drawn onto the visible **2D** canvas, then the shared whole-frame
 * post pass (vignette/grain/watermark/text, `drawPost`) layers on top. Keeping
 * the visible canvas 2D means GL init failure (or boot latency) transparently
 * falls back to the Canvas2D renderer on the same canvas.
 *
 * Default renderer (opt out with `?gl=0`). PixiJS is dynamically imported inside
 * boot() so it never enters the Canvas2D-only bundle.
 */
import type { Application, ColorMatrixFilter, Filter, Sprite, Texture } from "pixi.js";
import type { Compositor } from "../compositor";
import { type MediaCache, drawFrame, drawPost } from "../draw";
import { contain, cover, kenBurns } from "../fit";
import type { PipPlacement } from "../pip";
import { type RenderClip, type RenderSpec, clipsAt } from "../spec";
import { sampleTransform } from "../transform";
import { applyColorMatrix } from "./color";
import { type FilterCache, buildEffects } from "./effects";

type Pixi = typeof import("pixi.js");
type PixiFilters = typeof import("pixi-filters");

interface Layer {
  fg: Sprite; // the main contain/kenBurns clip
  bg: Sprite; // blurred cover background (BLUR_FILL mode)
  color: ColorMatrixFilter; // fg grade
  bgColor: ColorMatrixFilter; // bg grade
  bgBlur: Filter; // persistent blur for bg
}

export class GLCompositor implements Compositor {
  readonly kind = "gl" as const;

  private pixi: Pixi | null = null;
  private pf: PixiFilters | null = null;
  private app: Application | null = null;
  private gl: HTMLCanvasElement | null = null; // offscreen Pixi render target
  private base: Layer | null = null; // current clip
  private prev: Layer | null = null; // outgoing clip (crossfade)
  private overlays: Layer[] = []; // V2 PiP layers (grown on demand)
  private textures = new Map<string, Texture>();
  private cropTextures = new Map<string, Texture>(); // derived sub-rect views (crop effect)
  private effectFilters: FilterCache = new Map(); // cached per (clip, effect) — never per-frame
  private booting = false;
  private failed = false;
  private w = 0;
  private h = 0;

  render(canvas: HTMLCanvasElement, spec: RenderSpec, t: number, cache: MediaCache): void {
    // Until GL is ready (or if it failed), paint with the Canvas2D renderer so
    // the preview is never blank — the visible canvas is always 2D.
    if (this.failed || !this.app || !this.pixi || !this.gl || !this.base || !this.prev) {
      if (!this.failed) void this.boot(spec);
      const ctx = canvas.getContext("2d");
      if (ctx) drawFrame(ctx, spec, t, cache);
      canvas.dataset.slopGl = this.failed ? "failed" : "booting";
      return;
    }

    this.resize(spec.width, spec.height);
    const { current, outgoing, mix } = clipsAt(spec, t);
    this.configLayer(this.prev, outgoing, t, spec, cache, outgoing ? 1 - mix : 0);
    this.configLayer(this.base, current, t, spec, cache, outgoing ? mix : 1);

    // V2 overlays (picture-in-picture) composited over the base, in order.
    let oi = 0;
    for (const ov of spec.overlays) {
      if (t < ov.start || t >= ov.end || !ov.url) continue;
      this.configLayer(this.ensureOverlay(oi++), ov, t, spec, cache, 1, ov.pip);
    }
    for (let k = oi; k < this.overlays.length; k++) {
      this.overlays[k].fg.visible = false;
      this.overlays[k].bg.visible = false;
    }

    this.app.render();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = spec;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(this.gl, 0, 0, w, h);
    drawPost(ctx, spec, t, cache);
    canvas.dataset.slopGl = "1"; // GL actively rendered this frame (vs fallback)
  }

  private async boot(spec: RenderSpec): Promise<void> {
    if (this.booting) return;
    this.booting = true;
    try {
      this.teardown();
      const [pixi, pf] = await Promise.all([import("pixi.js"), import("pixi-filters")]);
      // Install PixiJS's eval-free polyfills before any renderer is created — the
      // desktop (Electron) Content-Security-Policy blocks unsafe-eval, which Pixi
      // otherwise uses to generate shader/uniform sync code. Harmless on web.
      await import("pixi.js/unsafe-eval");
      const gl = document.createElement("canvas");
      gl.width = spec.width;
      gl.height = spec.height;
      const app = new pixi.Application();
      await app.init({
        canvas: gl,
        width: spec.width,
        height: spec.height,
        background: 0x000000,
        backgroundAlpha: 0, // transparent — the visible canvas supplies the black bars
        antialias: false,
        autoStart: false,
        preference: "webgl",
        powerPreference: "high-performance",
      });
      app.ticker.stop();
      app.stage.sortableChildren = true; // z-order bg behind fg, prev behind base
      this.pixi = pixi;
      this.pf = pf;
      this.app = app;
      this.gl = gl;
      this.overlays = [];
      this.prev = this.makeLayer(0); // outgoing behind
      this.base = this.makeLayer(2); // current in front
      this.w = spec.width;
      this.h = spec.height;
    } catch (e) {
      console.error("[gl] init failed; falling back to Canvas2D:", e);
      this.failed = true;
    } finally {
      this.booting = false;
    }
  }

  /** Create a clip layer (bg + fg sprites) at z-base `z` and add it to the stage. */
  private makeLayer(z: number): Layer {
    const pixi = this.pixi!;
    const bg = new pixi.Sprite();
    bg.anchor.set(0.5);
    bg.visible = false;
    bg.zIndex = z;
    const fg = new pixi.Sprite();
    fg.anchor.set(0.5);
    fg.visible = false;
    fg.zIndex = z + 1;
    this.app!.stage.addChild(bg, fg);
    return {
      fg,
      bg,
      color: new pixi.ColorMatrixFilter(),
      bgColor: new pixi.ColorMatrixFilter(),
      bgBlur: new pixi.BlurFilter({ strength: 18, quality: 4 }),
    };
  }

  /** Reuse-or-create the i-th overlay layer (overlays stack on top of the base). */
  private ensureOverlay(i: number): Layer {
    let layer = this.overlays[i];
    if (!layer) {
      layer = this.makeLayer(4 + i * 2);
      this.overlays[i] = layer;
    }
    return layer;
  }

  private resize(w: number, h: number): void {
    if (!this.app || (this.w === w && this.h === h)) return;
    this.app.renderer.resize(w, h);
    this.w = w;
    this.h = h;
  }

  /** A GPU texture for a clip URL, refreshed from the live <video> each frame. */
  private textureFor(
    url: string,
    video: HTMLVideoElement | undefined,
    image: HTMLImageElement | undefined,
  ): Texture | null {
    if (!this.pixi) return null;
    let tex = this.textures.get(url);
    if (!tex) {
      try {
        if (video) {
          tex = new this.pixi.Texture({
            source: new this.pixi.VideoSource({ resource: video, autoPlay: false, updateFPS: 0 }),
          });
        } else if (image) {
          tex = this.pixi.Texture.from(image);
        } else {
          return null;
        }
      } catch {
        return null;
      }
      this.textures.set(url, tex);
    }
    if (video && video.readyState >= 2) {
      try {
        (tex.source as unknown as { update: () => void }).update();
      } catch {
        /* upload hiccup — keep last frame */
      }
    }
    return tex;
  }

  /** Position/scale/grade/effect one layer for `clip` at time `t`. */
  private configLayer(
    layer: Layer,
    clip: RenderClip | null,
    t: number,
    spec: RenderSpec,
    cache: MediaCache,
    alpha: number,
    pip?: PipPlacement,
  ): void {
    if (!clip || !clip.url || alpha <= 0) {
      layer.fg.visible = false;
      layer.bg.visible = false;
      return;
    }
    const video = cache.videos.get(clip.url);
    const image = cache.images.get(clip.url);
    const iw = video?.videoWidth || image?.naturalWidth || 0;
    const ih = video?.videoHeight || image?.naturalHeight || 0;
    const tex = this.textureFor(clip.url, video, image);
    if (!tex || !iw || !ih) {
      layer.fg.visible = false;
      layer.bg.visible = false;
      return;
    }
    const { width: w, height: h } = spec;
    const prog = clip.end > clip.start ? Math.min(1, Math.max(0, (t - clip.start) / (clip.end - clip.start))) : 0;
    const movingStill = clip.kind === "image" && clip.motion !== "NONE";

    // Fit: Ken Burns (animated cover) for moving stills, otherwise contain.
    const r = movingStill ? kenBurns(clip.motion, prog, iw, ih, w, h) : contain(iw, ih, w, h);
    let cx = r.dx + r.dw / 2;
    let cy = r.dy + r.dh / 2;
    let sx = r.dw / iw;
    let sy = r.dh / ih;

    // Keyframed transform (Effect Controls): zoom about frame centre + pan.
    if (clip.transform) {
      const tr = sampleTransform(clip.transform, prog);
      if (tr.scale !== 1 || tr.posX !== 0 || tr.posY !== 0) {
        // |scale-1| so pan margin is positive whether zooming in or shrinking.
        const panX = tr.posX * ((w * Math.abs(tr.scale - 1)) / 2);
        const panY = tr.posY * ((h * Math.abs(tr.scale - 1)) / 2);
        cx = w / 2 + tr.scale * (cx - w / 2) + panX;
        cy = h / 2 + tr.scale * (cy - h / 2) + panY;
        sx *= tr.scale;
        sy *= tr.scale;
      }
    }

    // V2 overlay: map the framed clip into the PiP box (center-based).
    let a = alpha;
    if (pip) {
      const s = Math.min(4, Math.max(0.02, pip.scale));
      cx = pip.posX * w + s * (cx - w / 2);
      cy = pip.posY * h + s * (cy - h / 2);
      sx *= s;
      sy *= s;
      a *= Math.min(1, Math.max(0, pip.opacity));
    }

    // Effect stack: built-in filters (blur/pixelate) + geometry (mirror/rotate/crop).
    const fx = buildEffects(this.pixi!, this.pf!, clip.effects, clip.id, this.effectFilters);
    let texture = tex;
    if (fx.crop) {
      const { l, r, t, b } = fx.crop;
      texture = this.croppedTexture(clip.url, tex, iw, ih, fx.crop);
      // Mask crop: keep the kept region at natural scale (no stretch), shifted so
      // it stays where it was; the cropped edges become transparent (black bars).
      cx += ((l - r) / 2) * (iw * sx); // iw*sx = current displayed full-image width
      cy += ((t - b) / 2) * (ih * sy);
    }

    const fg = layer.fg;
    fg.texture = texture;
    fg.visible = true;
    fg.alpha = a;
    fg.rotation = fx.rotationRad;
    fg.position.set(cx, cy);
    fg.scale.set(fx.flipX ? -sx : sx, fx.flipY ? -sy : sy);
    const colored = applyColorMatrix(layer.color, spec.colorLook, clip.adjust);
    fg.filters = colored ? [layer.color, ...fx.filters] : fx.filters;

    // BLUR_FILL: a blurred cover enlargement behind the contained clip fills the
    // letterbox bars. Skipped for moving stills (already cover) and overlays.
    if (spec.fillMode === "BLUR_FILL" && !movingStill && !pip) {
      const cv = cover(iw, ih, w, h);
      const bg = layer.bg;
      bg.texture = tex; // uncropped full frame
      bg.visible = true;
      bg.alpha = a;
      bg.rotation = 0;
      bg.position.set(w / 2, h / 2);
      bg.scale.set(cv.dw / iw, cv.dh / ih);
      const bgColored = applyColorMatrix(layer.bgColor, spec.colorLook, clip.adjust);
      bg.filters = bgColored ? [layer.bgColor, layer.bgBlur] : [layer.bgBlur];
    } else {
      layer.bg.visible = false;
    }
  }

  /** A cached sub-rect view of a clip's texture for the punch-in crop effect. */
  private croppedTexture(
    url: string,
    baseTex: Texture,
    iw: number,
    ih: number,
    c: { l: number; r: number; t: number; b: number },
  ): Texture {
    if (!this.pixi) return baseTex;
    const key = `${url}|${c.l}|${c.r}|${c.t}|${c.b}`;
    let tex = this.cropTextures.get(key);
    if (!tex) {
      try {
        const frame = new this.pixi.Rectangle(iw * c.l, ih * c.t, iw * (1 - c.l - c.r), ih * (1 - c.t - c.b));
        tex = new this.pixi.Texture({ source: baseTex.source, frame });
        this.cropTextures.set(key, tex);
      } catch {
        return baseTex;
      }
    }
    return tex;
  }

  private teardown(): void {
    for (const tex of this.cropTextures.values()) {
      try {
        tex.destroy(false); // a view onto a base texture's source — don't free the source
      } catch {
        /* ignore */
      }
    }
    this.cropTextures.clear();
    for (const { filter } of this.effectFilters.values()) {
      try {
        filter.destroy();
      } catch {
        /* ignore */
      }
    }
    this.effectFilters.clear();
    for (const tex of this.textures.values()) {
      try {
        tex.destroy(true);
      } catch {
        /* ignore */
      }
    }
    this.textures.clear();
    if (this.app) {
      try {
        this.app.destroy();
      } catch {
        /* ignore */
      }
    }
    this.app = null;
    this.base = null;
    this.prev = null;
    this.overlays = [];
    this.gl = null;
  }

  destroy(): void {
    this.teardown();
    this.pixi = null;
    this.pf = null;
  }
}
