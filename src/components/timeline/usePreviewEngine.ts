"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { registerCache, unregisterCache } from "@/lib/perf/registry";
import { type Compositor, pickCompositor } from "@/lib/render/compositor";
import { MediaCache } from "@/lib/render/draw";
import { type RenderSpec, clipsAt, sourceTime } from "@/lib/render/spec";

/**
 * Drives the live preview: a rAF clock, video-element seek/playback sync, and
 * VO/music audio. Returns transport controls + the canvas ref. All rendering is
 * client-side (the box never renders previews); ffmpeg is for the final export.
 */
export function usePreviewEngine(spec: RenderSpec, active = true) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<MediaCache | null>(null);
  const compositorRef = useRef<Compositor | null>(null);
  const voRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  // One <audio> element per audio-only clip (keyed by clip id), created lazily.
  const audioClipEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  const specRef = useRef(spec);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const volumeRef = useRef(1);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);

  // Keep refs current without writing during render (React-compiler clean).
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Create the media cache on mount (needs `document`); dispose on unmount.
  useEffect(() => {
    const cache = new MediaCache();
    cacheRef.current = cache;
    registerCache(cache); // expose to the perf HUD (decoders aren't in the DOM)
    compositorRef.current = pickCompositor();
    const els = audioClipEls.current;
    return () => {
      unregisterCache(cache);
      cache.dispose();
      cacheRef.current = null;
      compositorRef.current?.destroy();
      compositorRef.current = null;
      for (const el of els.values()) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      els.clear();
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const cache = cacheRef.current;
    const compositor = compositorRef.current;
    if (!canvas || !cache || !compositor) return;
    compositor.render(canvas, specRef.current, timeRef.current, cache);
  }, []);

  // Position the video elements + audio for time t (uses playingRef).
  const sync = useCallback((t: number) => {
    const s = specRef.current;
    const cache = cacheRef.current;
    if (!cache) return;
    const { current, outgoing } = clipsAt(s, t);
    const activeUrls = new Set([current?.url, outgoing?.url].filter(Boolean) as string[]);
    for (const [url, v] of cache.videos) if (!activeUrls.has(url) && !v.paused) v.pause();
    // Buffer only a window of clips around the playhead (current/outgoing + a
    // short lookahead so playback doesn't stall at clip boundaries) instead of
    // all N at once — this is what kills the load burst and caps memory.
    const LOOKAHEAD_S = 12;
    const preloadWindow = new Set(activeUrls);
    for (const c of s.clips) {
      if (c.url && c.start >= t && c.start <= t + LOOKAHEAD_S) preloadWindow.add(c.url);
    }
    for (const ov of s.overlays) {
      if (ov.url && t >= ov.start - LOOKAHEAD_S && t < ov.end) preloadWindow.add(ov.url);
    }
    cache.setActive(preloadWindow);
    // While paused, a clip just pulled into the window has no frame yet; redraw
    // once it can paint so scrubbing to a cold clip doesn't leave a blank frame.
    if (!playingRef.current && current?.url) {
      const cv = cache.videos.get(current.url);
      if (cv && cv.readyState < 2 && cv.dataset.slopRedraw !== "1") {
        cv.dataset.slopRedraw = "1";
        cv.addEventListener(
          "loadeddata",
          () => {
            cv.dataset.slopRedraw = "";
            draw();
          },
          { once: true },
        );
      }
    }
    for (const c of [current, outgoing]) {
      if (!c || c.kind !== "video" || !c.url) continue;
      const v = cache.videos.get(c.url);
      if (!v || v.readyState < 1) continue;
      const target = sourceTime(c, t);
      if (playingRef.current) {
        // Only the foreground clip is audible (and only if it isn't muted);
        // the outgoing clip during a transition stays silent.
        v.muted = c !== current || c.muted;
        v.volume = volumeRef.current;
        if (Number.isFinite(v.duration) && Math.abs(v.currentTime - target) > 0.25) v.currentTime = target;
        v.playbackRate = c.speed;
        if (v.paused) void v.play().catch(() => {});
      } else {
        v.muted = true; // no audio while paused / scrubbing
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - target) > 0.04) v.currentTime = target;
      }
    }
    // Overlay (V2…Vn) clips: advance each active overlay element so its PiP
    // animates, and sound it when unmuted — matching the render (where unmuted
    // overlay audio is mixed in). Skip any overlay sharing the foreground url.
    const fgUrls = new Set([current?.url, outgoing?.url].filter(Boolean));
    for (const ov of s.overlays) {
      if (ov.kind !== "video" || !ov.url || fgUrls.has(ov.url)) continue;
      const v = cache.videos.get(ov.url);
      if (!v || v.readyState < 1) continue;
      const within = t >= ov.start && t < ov.end;
      const target = sourceTime(ov, t);
      if (playingRef.current && within) {
        v.muted = ov.muted;
        v.volume = volumeRef.current;
        v.playbackRate = ov.speed;
        if (Number.isFinite(v.duration) && Math.abs(v.currentTime - target) > 0.25) v.currentTime = target;
        if (v.paused) void v.play().catch(() => {});
      } else {
        v.muted = true;
        if (!v.paused) v.pause();
        if (within && Math.abs(v.currentTime - target) > 0.04) v.currentTime = target;
      }
    }

    const vo = voRef.current;
    const music = musicRef.current;
    if (playingRef.current) {
      if (vo && vo.paused) {
        vo.currentTime = Math.min(t, vo.duration || t);
        void vo.play().catch(() => {});
      }
      if (music && music.paused) void music.play().catch(() => {});
    } else {
      if (vo && !vo.paused) vo.pause();
      if (music && !music.paused) music.pause();
      if (vo) vo.currentTime = Math.min(t, vo.duration || t);
    }

    // Audio-only clips: each plays its source audio in [start, start+dur].
    const els = audioClipEls.current;
    const liveIds = new Set(s.audioClips.map((c) => c.id));
    for (const [id, el] of els) {
      if (!liveIds.has(id) && !el.paused) el.pause();
    }
    for (const c of s.audioClips) {
      let el = els.get(c.id);
      if (!el) {
        el = document.createElement("audio");
        el.preload = "auto";
        el.src = c.url;
        els.set(c.id, el);
      }
      const within = t >= c.start && t < c.start + c.durationS;
      const target = c.srcStart + Math.max(0, t - c.start) * c.speed;
      if (playingRef.current && within) {
        el.volume = volumeRef.current;
        el.playbackRate = c.speed;
        if (Number.isFinite(el.duration) && Math.abs(el.currentTime - target) > 0.25) el.currentTime = target;
        if (el.paused) void el.play().catch(() => {});
      } else {
        if (!el.paused) el.pause();
      }
    }
  }, [draw]);

  const play = useCallback(() => {
    if (timeRef.current >= specRef.current.duration - 0.02) {
      timeRef.current = 0;
      setTime(0);
    }
    setPlaying(true);
  }, []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(specRef.current.duration, t));
      timeRef.current = clamped;
      setTime(clamped);
      sync(clamped);
      draw();
      window.setTimeout(draw, 60);
      window.setTimeout(draw, 180);
    },
    [sync, draw],
  );

  // When the monitor is hidden (e.g. the Rendered tab), pause the media elements
  // so we don't decode preview clips in the background. The playback loop and
  // media-load effects already no-op while `!active`; `playing` is left intact so
  // returning to Live resumes where it left off.
  useEffect(() => {
    if (active) return;
    const cache = cacheRef.current;
    if (cache) for (const v of cache.videos.values()) if (!v.paused) v.pause();
    voRef.current?.pause();
    musicRef.current?.pause();
    for (const el of audioClipEls.current.values()) if (!el.paused) el.pause();
  }, [active]);

  // The playback loop runs while `playing` and the monitor is active.
  useEffect(() => {
    if (!active) return;
    if (!playing) {
      sync(timeRef.current);
      draw();
      return;
    }
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    function loop(now: number) {
      const dt = Math.max(0, Math.min(0.25, (now - last) / 1000));
      last = now;
      let t = timeRef.current + dt;
      const dur = specRef.current.duration;
      if (t >= dur) {
        t = dur;
        timeRef.current = t;
        setTime(t);
        setPlaying(false);
        return;
      }
      timeRef.current = t;
      sync(t);
      draw();
      if (now - lastUi > 60) {
        lastUi = now;
        setTime(t);
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, active, sync, draw]);

  // Load media + redraw when the spec changes (only while the monitor is shown).
  useEffect(() => {
    if (!active) return;
    cacheRef.current?.ensure(spec);
    if (timeRef.current > spec.duration) {
      timeRef.current = spec.duration;
      setTime(spec.duration);
    }
    if (!playingRef.current) {
      sync(timeRef.current);
      const id = window.setTimeout(draw, 40);
      draw();
      return () => window.clearTimeout(id);
    }
  }, [spec, active, sync, draw]);

  // Keep audio element sources in sync with the spec.
  useEffect(() => {
    const vo = voRef.current;
    const music = musicRef.current;
    if (vo) {
      const src = spec.audio.voUrl ?? "";
      if (src && vo.src !== src) vo.src = src;
      vo.volume = Math.min(1, Math.max(0, spec.audio.voVolume)) * volume; // element gain caps at 1
    }
    if (music) {
      const src = spec.audio.musicUrl ?? "";
      if (src && music.src !== src) music.src = src;
      music.volume = Math.min(1, Math.max(0, spec.audio.musicVolume)) * volume;
      music.loop = true;
    }
  }, [spec.audio.voUrl, spec.audio.voVolume, spec.audio.musicUrl, spec.audio.musicVolume, volume]);

  // Master output volume (0–1) for the live preview — VO, music, and clip audio.
  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    for (const vid of cacheRef.current?.videos.values() ?? []) vid.volume = clamped;
    for (const el of audioClipEls.current.values()) el.volume = clamped;
  }, []);

  return { canvasRef, voRef, musicRef, time, playing, volume, duration: spec.duration, play, pause, toggle, seek, setVolume };
}
