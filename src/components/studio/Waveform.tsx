"use client";

import { useEffect, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WaveSurferInstance = any;

/**
 * A lightweight, non-interactive WaveSurfer waveform that fills its parent —
 * used to draw audio waveforms on timeline clips (muted/transparent + a soft
 * glow to match the multitrack look). Pass an auth-gated audio URL.
 */
export function Waveform({
  url,
  color = "#7a9d8a",
  className = "",
}: {
  url: string;
  color?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !url) return;
    let ws: WaveSurferInstance | null = null;
    let cancelled = false;
    void import("wavesurfer.js").then((mod) => {
      if (cancelled || !ref.current) return;
      ws = mod.default.create({
        container: ref.current,
        url,
        height: ref.current.clientHeight || 36,
        waveColor: `${color}99`,
        progressColor: `${color}99`,
        cursorColor: "transparent",
        normalize: true,
        interact: false,
        dragToSeek: false,
      });
    });
    return () => {
      cancelled = true;
      try {
        ws?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [url, color]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
    />
  );
}
