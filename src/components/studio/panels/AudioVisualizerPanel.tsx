"use client";

import { useEffect, useRef, useState } from "react";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { getAnalyser } from "@/lib/audio/visualizerBus";

type Mode = "bars" | "scope" | "spectrum";

const MODES: { key: Mode; label: string }[] = [
  { key: "bars", label: "Bars" },
  { key: "spectrum", label: "Spectrum" },
  { key: "scope", label: "Waveform" },
];

/**
 * Real-time visualizer for the *Multitrack Timeline* output. It reads the shared
 * AnalyserNode (visualizerBus) that every lane's audio is routed through — so it
 * reflects exactly what you hear when you press play in the Multitrack panel,
 * rather than being a separate audio player.
 */
export default function AudioVisualizerPanel({ windowControls }: PanelProps) {
  const [mode, setMode] = useState<Mode>("bars");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;

    const accent = "#6d8bff";
    let freq = new Uint8Array(1024);
    let time = new Uint8Array(2048);

    const draw = () => {
      const analyser = getAnalyser();
      const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
      const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
      g.fillStyle = "#0b0d12";
      g.fillRect(0, 0, w, h);

      if (analyser) {
        if (freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount);
        if (time.length !== analyser.fftSize) time = new Uint8Array(analyser.fftSize);
        const m = modeRef.current;

        if (m === "scope") {
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
          const bins = m === "spectrum" ? freq.length / 2 : 64;
          const step = Math.max(1, Math.floor(freq.length / 2 / bins));
          const bw = w / bins;
          for (let i = 0; i < bins; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += freq[i * step + j] || 0;
            const mag = sum / step / 255;
            const bh = mag * h;
            const hue = 220 - mag * 140;
            g.fillStyle = m === "spectrum" ? `hsl(${hue},70%,55%)` : accent;
            g.fillRect(i * bw, h - bh, Math.max(1, bw - 1 * devicePixelRatio), bh);
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <PanelChrome title="Visualizer" icon="📊" {...windowControls}>
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--color-muted)]">Multitrack output</span>
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

        <p className="text-center text-[11px] text-[var(--color-muted)]">
          Visualizing the Multitrack Timeline — press play there to see it move.
        </p>
      </div>
    </PanelChrome>
  );
}
