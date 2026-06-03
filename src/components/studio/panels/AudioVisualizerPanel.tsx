"use client";

import { useEffect, useRef, useState } from "react";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useAudioStudioStore } from "@/stores/audioStudioStore";

type Mode = "bars" | "scope" | "spectrum";

/** Real-time audio visualizer driven by a Web Audio AnalyserNode. */
export default function AudioVisualizerPanel({ windowControls }: PanelProps) {
  const tracks = useAudioStudioStore((s) => s.tracks);
  const selectedTrackId = useAudioStudioStore((s) => s.selectedTrackId);
  const select = useAudioStudioStore((s) => s.select);

  const [mode, setMode] = useState<Mode>("bars");
  const selected = tracks.find((t) => t.id === selectedTrackId) ?? tracks[0] ?? null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Wire the analyser graph once an audio element + selected track exist.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const src = ctx.createMediaElementSource(audio);
      src.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      srcRef.current = src;
    }

    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const freq = new Uint8Array(analyser.frequencyBinCount);
    const time = new Uint8Array(analyser.fftSize);
    const accent = "#6d8bff";

    const draw = () => {
      const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
      const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
      g.clearRect(0, 0, w, h);
      g.fillStyle = "#0b0d12";
      g.fillRect(0, 0, w, h);

      if (mode === "scope") {
        analyser.getByteTimeDomainData(time);
        g.lineWidth = 2 * devicePixelRatio;
        g.strokeStyle = accent;
        g.beginPath();
        const slice = w / time.length;
        for (let i = 0; i < time.length; i++) {
          const v = time[i] / 128;
          const y = (v * h) / 2;
          const x = i * slice;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      } else {
        analyser.getByteFrequencyData(freq);
        const bins = mode === "spectrum" ? freq.length / 2 : 64;
        const step = Math.floor(freq.length / 2 / bins);
        const bw = w / bins;
        for (let i = 0; i < bins; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += freq[i * step + j];
          const mag = sum / step / 255;
          const bh = mag * h;
          const hue = 220 - mag * 140;
          g.fillStyle = mode === "spectrum" ? `hsl(${hue},70%,55%)` : accent;
          g.fillRect(i * bw, h - bh, Math.max(1, bw - 1 * devicePixelRatio), bh);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, selected?.id]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const MODES: { key: Mode; label: string }[] = [
    { key: "bars", label: "Bars" },
    { key: "spectrum", label: "Spectrum" },
    { key: "scope", label: "Waveform" },
  ];

  return (
    <PanelChrome title="Visualizer" icon="📊" {...windowControls}>
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={selected?.id ?? ""}
            onChange={(e) => select(e.target.value || null)}
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
          >
            {tracks.length === 0 ? <option value="">No tracks</option> : null}
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border border-[var(--color-border)]">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`px-2 py-1 text-[10px] ${mode === m.key ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-[var(--color-border)]">
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>

        {selected ? (
          <audio
            ref={audioRef}
            src={selected.url}
            controls
            crossOrigin="anonymous"
            className="h-8 w-full"
            onPlay={() => ctxRef.current?.resume()}
          />
        ) : (
          <p className="text-center text-[11px] text-[var(--color-muted)]">Select a track and press play to visualize.</p>
        )}
      </div>
    </PanelChrome>
  );
}
