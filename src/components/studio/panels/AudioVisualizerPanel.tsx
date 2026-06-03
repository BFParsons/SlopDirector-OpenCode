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
      // Setting canvas.width above reset the context, so the background fill has
      // no shadow. The visualization itself gets a transparent fill + a glow.
      g.fillStyle = "#0b0d12";
      g.fillRect(0, 0, w, h);

      if (analyser) {
        if (freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount);
        if (time.length !== analyser.fftSize) time = new Uint8Array(analyser.fftSize);
        const m = modeRef.current;
        g.shadowBlur = 8 * devicePixelRatio; // hazy halo to match the multitrack lanes

        if (m === "scope") {
          analyser.getByteTimeDomainData(time);
          g.lineWidth = Math.max(1, 1.5 * devicePixelRatio);
          g.strokeStyle = "rgba(109,139,255,0.65)";
          g.shadowColor = accent;
          g.beginPath();
          const slice = w / time.length;
          for (let i = 0; i < time.length; i++) {
            const v = time[i] / 128; // 0..2, silence ≈ 1
            const y = (v / 2) * h; // centered on h/2
            const x = i * slice;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.stroke();
        } else {
          analyser.getByteFrequencyData(freq);
          // Skip the highest (mostly-empty) bins so the bars fill the width.
          const usable = Math.max(16, Math.floor(freq.length * 0.85));
          const bins = m === "spectrum" ? 128 : 56;
          const step = Math.max(1, Math.floor(usable / bins));
          const gapPx = (m === "spectrum" ? 1 : 2) * devicePixelRatio;
          const bw = w / bins;
          for (let i = 0; i < bins; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += freq[i * step + j] || 0;
            const mag = sum / step / 255;
            const bh = mag * h;
            if (m === "spectrum") {
              const hue = 250 - mag * 200;
              g.fillStyle = `hsla(${hue}, 70%, 60%, 0.55)`;
              g.shadowColor = `hsl(${hue}, 70%, 60%)`;
            } else {
              g.fillStyle = "rgba(109,139,255,0.55)";
              g.shadowColor = accent;
            }
            g.fillRect(i * bw, h - bh, Math.max(1, bw - gapPx), bh);
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
      <div className="relative h-full w-full overflow-hidden bg-[#0b0d12]">
        <canvas ref={canvasRef} className="block h-full w-full" />
        {/* Compact mode selector, top-left. Native <select> so its menu renders in
            the browser's top layer — never clipped and never adds a scrollbar. */}
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="absolute left-1 top-1 z-10 rounded border border-[var(--color-border)] bg-[var(--color-card)]/80 px-1 py-0.5 text-[10px] text-[var(--color-fg)] outline-none backdrop-blur-sm"
        >
          {MODES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </PanelChrome>
  );
}
