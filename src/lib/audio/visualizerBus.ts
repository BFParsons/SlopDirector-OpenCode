"use client";

/**
 * A single shared Web Audio graph for the Audio Studio: every Multitrack lane's
 * media element is routed through one master gain into one AnalyserNode, so the
 * Visualizer can render the *combined* multitrack output (post mute/solo/volume)
 * instead of being its own separate player.
 *
 *   <audio per track> --createMediaElementSource--> master --> analyser --> destination
 *
 * A MediaElementSource can only be created once per element, so connections are
 * de-duped via a WeakSet. The analyser must reach `destination` or rerouting the
 * element through Web Audio would silence playback.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
const connected = new WeakSet<HTMLMediaElement>();

function ensure(): void {
  if (ctx) return;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  master.connect(analyser);
  analyser.connect(ctx.destination);
}

/** The shared analyser (lazily creates the graph). Safe to call every frame. */
export function getAnalyser(): AnalyserNode | null {
  if (typeof window === "undefined") return null;
  ensure();
  return analyser;
}

/** Route a Multitrack lane's media element into the shared graph (idempotent). */
export function connectMediaElement(el: HTMLMediaElement | null | undefined): void {
  if (!el || typeof window === "undefined") return;
  ensure();
  if (!ctx || !master || connected.has(el)) return;
  try {
    const src = ctx.createMediaElementSource(el);
    src.connect(master);
    connected.add(el);
  } catch {
    // Already connected elsewhere, or element not eligible — ignore.
  }
}

/** Resume the context on a user gesture (browser autoplay policy). */
export function resumeAudio(): void {
  ctx?.resume().catch(() => {});
}
