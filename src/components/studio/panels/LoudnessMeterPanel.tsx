"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useAudioStudioStore } from "@/stores/audioStudioStore";

interface LoudnessReport {
  integratedLufs: number | null;
  truePeakDb: number | null;
  loudnessRange: number | null;
  thresholdLufs: number | null;
}
interface ProcessResult {
  relPath: string;
  name: string;
  durationS: number;
  url: string;
}

const TARGETS = [
  { lufs: -14, label: "−14 (Spotify / YouTube / social)" },
  { lufs: -16, label: "−16 (Apple Podcasts)" },
  { lufs: -23, label: "−23 (EBU R128 broadcast)" },
];

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] p-2 text-center">
      <div className="font-mono tnum text-lg font-semibold">{value == null ? "—" : value.toFixed(1)}</div>
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-muted)]">
        {label} {unit}
      </div>
    </div>
  );
}

export default function LoudnessMeterPanel({ windowControls }: PanelProps) {
  const tracks = useAudioStudioStore((s) => s.tracks);
  const selectedTrackId = useAudioStudioStore((s) => s.selectedTrackId);
  const select = useAudioStudioStore((s) => s.select);
  const addTrack = useAudioStudioStore((s) => s.addTrack);
  const projectId = useAudioStudioStore((s) => s.projectId);
  const selected = tracks.find((t) => t.id === selectedTrackId) ?? tracks[0] ?? null;

  const [report, setReport] = useState<LoudnessReport | null>(null);
  const [target, setTarget] = useState(-14);
  const [busy, setBusy] = useState(false);
  const [normBusy, setNormBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function measure() {
    if (!selected || !projectId) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await api<{ loudness: LoudnessReport }>("/api/audio/analyze", {
        method: "POST",
        body: JSON.stringify({ projectId, path: selected.relPath, kinds: ["loudness"] }),
      });
      setReport(res.loudness);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function normalize() {
    if (!selected || !projectId) return;
    setNormBusy(true);
    setError(null);
    try {
      const res = await api<ProcessResult>("/api/audio/process", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          path: selected.relPath,
          effects: [{ type: "loudness", targetLufs: target }],
          label: `${selected.name} · ${target} LUFS`,
        }),
      });
      addTrack({ name: res.name, relPath: res.relPath, url: res.url, durationS: res.durationS, kind: "processed" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setNormBusy(false);
    }
  }

  const integrated = report?.integratedLufs ?? null;
  const delta = integrated != null ? target - integrated : null;

  return (
    <PanelChrome title="Loudness Meter" icon="📈" {...windowControls}>
      <div className="flex h-full flex-col gap-3 p-3 text-xs">
        <select
          value={selected?.id ?? ""}
          onChange={(e) => select(e.target.value || null)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5"
        >
          {tracks.length === 0 ? <option value="">Import a track first</option> : null}
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={measure}
          disabled={!selected || busy}
          className="rounded-md border border-[var(--color-border)] px-3 py-2 font-medium transition hover:border-[var(--color-accent)] disabled:opacity-40"
        >
          {busy ? "Measuring…" : "Measure loudness (EBU R128)"}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Integrated" value={integrated} unit="LUFS" />
          <Stat label="True peak" value={report?.truePeakDb ?? null} unit="dBTP" />
          <Stat label="Range" value={report?.loudnessRange ?? null} unit="LU" />
        </div>

        {delta != null ? (
          <p className={`text-center text-[11px] ${Math.abs(delta) < 1 ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"}`}>
            {Math.abs(delta) < 1 ? "On target" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} LU to reach ${target} LUFS`}
          </p>
        ) : null}

        <div className="mt-auto space-y-2">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Normalize target</span>
            <select value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5">
              {TARGETS.map((t) => (
                <option key={t.lufs} value={t.lufs}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={normalize}
            disabled={!selected || normBusy}
            className="w-full rounded-md bg-[var(--color-accent)] px-3 py-2 font-medium text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {normBusy ? "Normalizing…" : "Normalize → new track"}
          </button>
          {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}
        </div>
      </div>
    </PanelChrome>
  );
}
