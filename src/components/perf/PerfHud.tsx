"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { type MediaStats, mediaStats } from "@/lib/perf/registry";

/**
 * Perf HUD — a dev-only overlay that turns "clips before lag" into numbers.
 *
 * Enable with `?perf=1` in the URL (or `localStorage.slop:perf = "1"`). It runs
 * its own rAF clock (a proxy for main-thread jank — when the preview engine
 * stutters, this loop's frame intervals stretch too), a longtask observer, and
 * reads the JS heap + the real decoder population from the MediaCache registry
 * and the DOM `<video>` census (timeline/bucket thumbnails).
 *
 * It also publishes `window.__slopPerf()` returning the latest summary, so a
 * Playwright harness can sample it via `page.evaluate` without scraping the DOM.
 */

export interface PerfSummary {
  fps: number; // frames in the last window, per second
  jankFrames: number; // frames slower than ~25ms (dropped at 60Hz) in the window
  worstMs: number; // worst single frame interval in the window
  longTasks: number; // longtasks (>50ms) observed in the window
  blockingMs: number; // sum of (longtask.duration - 50) in the window
  heapMB: number | null; // used JS heap (Chrome only)
  domVideos: number; // <video> elements in the DOM (thumbnails)
  decoders: MediaStats; // compositor decoder population (not in the DOM)
  ts: number;
}

interface PerfMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

const WINDOW_MS = 500;
const JANK_MS = 25; // > 1.5 frames at 60Hz

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("perf") === "1") return true;
    return window.localStorage.getItem("slop:perf") === "1";
  } catch {
    return false;
  }
}

const emptySubscribe = () => () => {};

export function PerfHud() {
  // Client-only flag without setState-in-effect or a hydration mismatch:
  // server snapshot is always false, client snapshot reads the URL/localStorage.
  const enabled = useSyncExternalStore(
    emptySubscribe,
    () => isEnabled(),
    () => false,
  );
  const [summary, setSummary] = useState<PerfSummary | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Longtask observer (best-effort; unsupported in some browsers).
    let longTasks = 0;
    let blockingMs = 0;
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          longTasks++;
          blockingMs += Math.max(0, e.duration - 50);
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      observer = null;
    }

    let raf = 0;
    let last = performance.now();
    let windowStart = last;
    let frames = 0;
    let jank = 0;
    let worst = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames++;
      if (dt > JANK_MS) jank++;
      if (dt > worst) worst = dt;

      if (now - windowStart >= WINDOW_MS) {
        const secs = (now - windowStart) / 1000;
        const mem = (performance as Performance & { memory?: PerfMemory }).memory;
        const next: PerfSummary = {
          fps: Math.round(frames / secs),
          jankFrames: jank,
          worstMs: Math.round(worst),
          longTasks,
          blockingMs: Math.round(blockingMs),
          heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
          domVideos: document.querySelectorAll("video").length,
          decoders: mediaStats(),
          ts: Math.round(now),
        };
        setSummary(next);
        (window as Window & { __slopPerf?: () => PerfSummary }).__slopPerf = () => next;
        // reset window accumulators
        windowStart = now;
        frames = 0;
        jank = 0;
        worst = 0;
        longTasks = 0;
        blockingMs = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [enabled]);

  if (!enabled || !summary) return null;

  const s = summary;
  const warn = s.fps < 50 || s.jankFrames > 4;
  const bad = s.fps < 30 || s.jankFrames > 10;
  const color = bad ? "#ff5c5c" : warn ? "#ffcc4d" : "#5cff9d";

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 99999,
        minWidth: 188,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(8,11,18,0.86)",
        border: `1px solid ${color}`,
        color: "#e6e9ef",
        font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        pointerEvents: "none",
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <strong style={{ color }}>PERF</strong>
        <span style={{ color, fontWeight: 700 }}>{s.fps} fps</span>
      </div>
      {row("jank frames", `${s.jankFrames}/win`)}
      {row("worst frame", `${s.worstMs} ms`)}
      {row("long tasks", `${s.longTasks} · ${s.blockingMs}ms`)}
      {row("heap", s.heapMB == null ? "n/a" : `${s.heapMB} MB`)}
      {row("decoders", `${s.decoders.decoding}▶ / ${s.decoders.ready}● / ${s.decoders.videos}`)}
      {row("dom <video>", String(s.domVideos))}
    </div>
  );
}
