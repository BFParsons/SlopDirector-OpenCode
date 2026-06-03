/**
 * Canvas2D compositor for the live preview. Pure rendering: given the current
 * media-element state + a timeline time, draw one composited frame with the
 * Tier-A effect stack. The browser engine (usePreviewEngine) owns seeking /
 * playback; this just paints. Effects are visual approximations of the ffmpeg
 * filters — the exported MP4 is authoritative.
 */
import { effectsCssFilter } from "@/config/effects";
import { contain, cover, kenBurns, posXY } from "./fit";
import { type ColorLook, type RenderClip, type RenderSpec, clipsAt } from "./spec";
import { sampleTransform } from "./transform";

export type MediaEl = HTMLVideoElement | HTMLImageElement;

/** Holds one <video>/<img> element per clip URL. The engine drives playback. */
export class MediaCache {
  videos = new Map<string, HTMLVideoElement>();
  images = new Map<string, HTMLImageElement>();
  /** URLs already upgraded to eager buffering — so we load() each at most once. */
  private activated = new Set<string>();

  ensure(spec: RenderSpec): void {
    if (spec.watermark && !this.images.has(spec.watermark.url)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = spec.watermark.url;
      this.images.set(spec.watermark.url, img);
    }
    for (const c of [...spec.clips, ...spec.overlays]) {
      if (!c.url) continue;
      if (c.kind === "video" && !this.videos.has(c.url)) {
        const v = document.createElement("video");
        v.src = c.url;
        v.crossOrigin = "anonymous";
        v.muted = true; // clip audio handled separately; muted so it can autoplay
        v.playsInline = true;
        // Lazy by default: buffering every clip up front is an N-wide load burst
        // + memory bomb. The engine upgrades clips near the playhead via
        // setActive(); distant clips stay unloaded until they enter the window.
        v.preload = "none";
        this.videos.set(c.url, v);
      } else if (c.kind === "image" && !this.images.has(c.url)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = c.url;
        this.images.set(c.url, img);
      }
    }
    // Elements are kept for the engine's lifetime and freed in dispose() on
    // unmount. (Eviction-by-url was tried but aborted in-flight clip loads.)
  }

  get(clip: RenderClip): MediaEl | null {
    if (!clip.url) return null;
    return clip.kind === "video"
      ? (this.videos.get(clip.url) ?? null)
      : (this.images.get(clip.url) ?? null);
  }

  /**
   * Eagerly buffer just the clips the engine asks for (a window around the
   * playhead). Each URL is upgraded + load()ed at most once; we never tear down
   * an in-flight load here — that aborts decodes — so this only grows the loaded
   * set. (LRU eviction of clips that left the window is a separate later step.)
   */
  setActive(urls: Set<string>): void {
    for (const url of urls) {
      if (this.activated.has(url)) continue;
      const v = this.videos.get(url);
      if (!v) continue;
      this.activated.add(url);
      v.preload = "auto";
      v.load();
    }
  }

  dispose(): void {
    for (const v of this.videos.values()) {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }
    this.videos.clear();
    this.images.clear();
    this.activated.clear();
  }
}

function ready(el: MediaEl): boolean {
  return el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
}
function dims(el: MediaEl): { w: number; h: number } {
  return el instanceof HTMLVideoElement
    ? { w: el.videoWidth, h: el.videoHeight }
    : { w: el.naturalWidth, h: el.naturalHeight };
}

// ---- effect helpers (approximations of the ffmpeg looks) --------------------

function colorFilter(look: ColorLook, adj: { brightness: number; contrast: number; saturation: number }): string {
  const p: string[] = [];
  if (adj.brightness !== 0) p.push(`brightness(${(1 + adj.brightness).toFixed(3)})`);
  if (adj.contrast !== 1) p.push(`contrast(${adj.contrast.toFixed(3)})`);
  if (adj.saturation !== 1) p.push(`saturate(${adj.saturation.toFixed(3)})`);
  switch (look) {
    case "WARM": p.push("saturate(1.08)", "sepia(0.12)"); break;
    case "COOL": p.push("saturate(0.92)", "hue-rotate(-12deg)"); break;
    case "BW": p.push("grayscale(1)", "contrast(1.08)"); break;
    case "VINTAGE": p.push("sepia(0.35)", "saturate(0.85)", "contrast(0.96)"); break;
    case "PUNCH": p.push("contrast(1.18)", "saturate(1.25)"); break;
    case "TEAL_ORANGE": p.push("saturate(1.12)", "contrast(1.08)", "hue-rotate(-6deg)"); break;
    case "NOIR": p.push("grayscale(1)", "contrast(1.35)", "brightness(0.95)"); break;
    case "CAMPAIGN": p.push("sepia(0.15)", "saturate(1.1)", "brightness(1.03)", "contrast(1.05)"); break;
    case "BLEACH": p.push("saturate(0.55)", "contrast(1.3)", "brightness(0.97)"); break;
    default: break;
  }
  return p.length ? p.join(" ") : "none";
}

// contain / cover / kenBurns / posXY now live in ./fit (shared with the GL renderer).

let noise: HTMLCanvasElement | null = null;
function noiseCanvas(): HTMLCanvasElement {
  if (noise) return noise;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const nx = c.getContext("2d")!;
  const img = nx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + ((i * 2654435761) % 90); // cheap deterministic-ish noise
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
  noise = c;
  return c;
}

/** Draw one clip (its current decoded frame) with fit/blur-fill + Ken Burns. */
function drawClip(ctx: CanvasRenderingContext2D, spec: RenderSpec, clip: RenderClip, t: number, el: MediaEl, alpha: number) {
  const { w, h } = { w: spec.width, h: spec.height };
  const { w: iw, h: ih } = dims(el);
  if (!iw || !ih) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Color look + the few effects Canvas2D can preview live (blur). Export-only
  // effects (chroma key, crop, …) apply at render — see the panel's badge.
  const colorF = colorFilter(spec.colorLook, clip.adjust);
  const fxF = effectsCssFilter(clip.effects);
  const filter = fxF ? `${colorF === "none" ? "" : colorF} ${fxF}`.trim() : colorF;

  // Keyframed Motion (Effect Controls): zoom + pan about the frame, sampled at
  // this clip's normalized progress. Mirrors the ffmpeg zoompan on export.
  if (clip.transform) {
    const p = clip.end > clip.start ? Math.min(1, Math.max(0, (t - clip.start) / (clip.end - clip.start))) : 0;
    const tr = sampleTransform(clip.transform, p);
    if (tr.scale !== 1 || tr.posX !== 0 || tr.posY !== 0) {
      const panX = tr.posX * ((w * Math.abs(tr.scale - 1)) / 2);
      const panY = tr.posY * ((h * Math.abs(tr.scale - 1)) / 2);
      ctx.translate(w / 2 + panX, h / 2 + panY);
      ctx.scale(tr.scale, tr.scale);
      ctx.translate(-w / 2, -h / 2);
    }
  }

  if (clip.kind === "image" && clip.motion !== "NONE") {
    const p = clip.end > clip.start ? Math.min(1, Math.max(0, (t - clip.start) / (clip.end - clip.start))) : 0;
    const r = kenBurns(clip.motion, p, iw, ih, w, h);
    ctx.filter = filter;
    ctx.drawImage(el, r.dx, r.dy, r.dw, r.dh);
  } else if (spec.fillMode === "BLUR_FILL") {
    const cv = cover(iw, ih, w, h);
    ctx.filter = `blur(18px) ${filter === "none" ? "" : filter}`.trim();
    ctx.drawImage(el, -(cv.dw - w) / 2, -(cv.dh - h) / 2, cv.dw, cv.dh);
    const c = contain(iw, ih, w, h);
    ctx.filter = filter;
    ctx.drawImage(el, c.dx, c.dy, c.dw, c.dh);
  } else {
    const c = contain(iw, ih, w, h);
    ctx.filter = filter;
    ctx.drawImage(el, c.dx, c.dy, c.dw, c.dh);
  }
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, spec: RenderSpec, t: number) {
  for (const tx of spec.texts) {
    if (!tx.text.trim()) continue;
    const e = tx.endS;
    if (t < tx.startS || (e != null && t > e)) continue;
    let alpha = 1;
    if (tx.animation === "FADE") {
      const f = e != null ? Math.min(0.4, (e - tx.startS) / 2) : 0.4;
      if (t < tx.startS + f) alpha = (t - tx.startS) / f;
      else if (e != null && t > e - f) alpha = (e - t) / f;
      alpha = Math.min(1, Math.max(0, alpha));
    }
    const fs = Math.max(10, Math.round((tx.sizePct / 100) * spec.height));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${fs}px "DejaVu Sans", system-ui, sans-serif`;
    ctx.textBaseline = "top";
    const lines = tx.text.split("\n");
    const lh = fs * 1.15;
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const th = lh * lines.length;
    const pad = Math.max(4, Math.round(fs * 0.3));
    const { x, y } = posXY(tx.position, tx.marginPx, spec.width, spec.height, tw, th);
    if (tx.boxEnabled) {
      ctx.fillStyle = tx.boxColor;
      ctx.globalAlpha = alpha * tx.boxOpacity;
      ctx.fillRect(x - pad, y - pad, tw + pad * 2, th + pad * 2);
      ctx.globalAlpha = alpha;
    }
    ctx.fillStyle = tx.color;
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    ctx.restore();
  }
}

/** Draw a V2 overlay clip as a picture-in-picture box over the base. */
function drawOverlay(ctx: CanvasRenderingContext2D, spec: RenderSpec, ov: RenderSpec["overlays"][number], t: number, el: MediaEl) {
  const W = spec.width;
  const H = spec.height;
  const s = Math.min(4, Math.max(0.02, ov.pip.scale));
  const pipW = W * s;
  const pipH = H * s;
  // Center-based: posX/posY is the centre of the box as a fraction of the frame
  // (may place the box partly/fully off-frame).
  const x = ov.pip.posX * W - pipW / 2;
  const y = ov.pip.posY * H - pipH / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, pipW, pipH);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(s, s); // the box is a scaled-down full frame; draw the clip into it
  drawClip(ctx, spec, ov, t, el, Math.min(1, Math.max(0, ov.pip.opacity)));
  ctx.restore();
}

/** Composite one frame of the timeline at time t onto ctx. */
export function drawFrame(ctx: CanvasRenderingContext2D, spec: RenderSpec, t: number, cache: MediaCache): void {
  const { width: w, height: h } = spec;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const { current, outgoing, mix } = clipsAt(spec, t);
  if (outgoing) {
    const oe = cache.get(outgoing);
    if (oe && ready(oe)) drawClip(ctx, spec, outgoing, t, oe, 1 - mix);
  }
  if (current) {
    const ce = cache.get(current);
    if (ce && ready(ce)) drawClip(ctx, spec, current, t, ce, outgoing ? mix : 1);
    else if (!current.url) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${Math.round(h / 18)}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText("clip not generated yet", w / 2, h / 2);
      ctx.textAlign = "left";
    }
  }

  // V2 overlays (picture-in-picture) composited over the base.
  for (const ov of spec.overlays) {
    if (t < ov.start || t >= ov.end) continue;
    const el = cache.get(ov);
    if (el && ready(el)) drawOverlay(ctx, spec, ov, t, el);
    else if (!ov.url) continue;
  }

  drawPost(ctx, spec, t, cache);
}

/**
 * Whole-frame post — vignette, grain, watermark, text. Shared by the Canvas2D
 * renderer (above) and the GL compositor, which composites its WebGL output onto
 * the visible 2D canvas and then layers this pass on top, so both paths produce
 * identical post regardless of how the clips underneath were rendered.
 */
export function drawPost(ctx: CanvasRenderingContext2D, spec: RenderSpec, t: number, cache: MediaCache): void {
  const { width: w, height: h } = spec;
  if (spec.vignette) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (spec.grain > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.25, (spec.grain / 100) * 0.3);
    ctx.globalCompositeOperation = "overlay";
    const n = noiseCanvas();
    for (let y = 0; y < h; y += n.height) for (let x = 0; x < w; x += n.width) ctx.drawImage(n, x, y);
    ctx.restore();
  }
  if (spec.watermark) {
    const wm = cache.images.get(spec.watermark.url);
    if (wm && wm.complete && wm.naturalWidth) {
      const ww = Math.max(4, w * Math.min(1, Math.max(0.02, spec.watermark.scale)));
      const wh = ww * (wm.naturalHeight / wm.naturalWidth);
      const { x, y } = posXY(spec.watermark.position, spec.watermark.margin, w, h, ww, wh);
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, spec.watermark.opacity));
      ctx.drawImage(wm, x, y, ww, wh);
      ctx.restore();
    }
  }
  drawText(ctx, spec, t);
}
