"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useAudioStudioStore } from "@/stores/audioStudioStore";

interface ProcessResult {
  relPath: string;
  name: string;
  durationS: number;
  url: string;
}

/** A labeled effect module with an enable toggle and a slot for controls. */
function Module({
  name,
  enabled,
  onToggle,
  children,
}: {
  name: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border border-[var(--color-border)] p-2 ${enabled ? "" : "opacity-55"}`}>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="accent-[var(--color-accent)]" />
        <span className="text-xs font-semibold">{name}</span>
      </label>
      {enabled && children ? <div className="mt-2 space-y-1.5">{children}</div> : null}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="w-16 shrink-0 text-[var(--color-muted)]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 flex-1 accent-[var(--color-accent)]" />
      <span className="w-12 shrink-0 text-right font-mono tnum">
        {value}
        {unit}
      </span>
    </label>
  );
}

export default function AudioProcessingPanel({ windowControls }: PanelProps) {
  const tracks = useAudioStudioStore((s) => s.tracks);
  const selectedTrackId = useAudioStudioStore((s) => s.selectedTrackId);
  const select = useAudioStudioStore((s) => s.select);
  const addTrack = useAudioStudioStore((s) => s.addTrack);
  const projectId = useAudioStudioStore((s) => s.projectId);
  const selected = tracks.find((t) => t.id === selectedTrackId) ?? tracks[0] ?? null;

  // Effect enables + params.
  const [noise, setNoise] = useState({ on: false, strength: 0.5 });
  const [rnn, setRnn] = useState({ on: false, mix: 0.9 });
  const [leveler, setLeveler] = useState({ on: false, strength: 0.5 });
  const [eq, setEq] = useState({ on: false, bassDb: 0, midDb: 0, trebleDb: 0 });
  const [rolloff, setRolloff] = useState({ on: false, highpassHz: 80, lowpassHz: 0 });
  const [deesser, setDeesser] = useState({ on: false, intensity: 0.5 });
  const [comp, setComp] = useState({ on: false, thresholdDb: -18, ratio: 3 });
  const [loud, setLoud] = useState({ on: false, targetLufs: -14 });
  const [gain, setGain] = useState({ on: false, db: 0 });
  const [fade, setFade] = useState({ on: false, inS: 0, outS: 0 });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildEffects() {
    const fx: Record<string, unknown>[] = [];
    if (rolloff.on) fx.push({ type: "rolloff", highpassHz: rolloff.highpassHz, lowpassHz: rolloff.lowpassHz });
    if (noise.on) fx.push({ type: "noise", strength: noise.strength });
    if (rnn.on) fx.push({ type: "rnnoise", mix: rnn.mix });
    if (eq.on) fx.push({ type: "eq", bassDb: eq.bassDb, midDb: eq.midDb, trebleDb: eq.trebleDb });
    if (deesser.on) fx.push({ type: "deesser", intensity: deesser.intensity });
    if (comp.on) fx.push({ type: "compressor", thresholdDb: comp.thresholdDb, ratio: comp.ratio });
    if (leveler.on) fx.push({ type: "speechnorm", strength: leveler.strength });
    if (gain.on) fx.push({ type: "gain", db: gain.db });
    if (fade.on) fx.push({ type: "fade", inS: fade.inS, outS: fade.outS, durationS: selected?.durationS ?? 0 });
    // Loudness normalization goes last so it accounts for everything above.
    if (loud.on) fx.push({ type: "loudness", targetLufs: loud.targetLufs });
    return fx;
  }

  async function apply() {
    if (!selected || !projectId) return;
    const effects = buildEffects();
    if (!effects.length) {
      setError("Enable at least one effect.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<ProcessResult>("/api/audio/process", {
        method: "POST",
        body: JSON.stringify({ projectId, path: selected.relPath, effects, label: `${selected.name} · processed` }),
      });
      addTrack({ name: res.name, relPath: res.relPath, url: res.url, durationS: res.durationS, kind: "processed" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelChrome title="Processing Rack" icon="◆" {...windowControls}>
      <div className="flex h-full flex-col gap-2 p-3 text-xs">
        <select
          value={selected?.id ?? ""}
          onChange={(e) => select(e.target.value || null)}
          className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5"
        >
          {tracks.length === 0 ? <option value="">Import a track first</option> : null}
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          <Module name="Roll-off (rumble / hiss)" enabled={rolloff.on} onToggle={(v) => setRolloff({ ...rolloff, on: v })}>
            <Slider label="High-pass" value={rolloff.highpassHz} min={0} max={400} step={10} unit="Hz" onChange={(v) => setRolloff({ ...rolloff, highpassHz: v })} />
            <Slider label="Low-pass" value={rolloff.lowpassHz} min={0} max={20000} step={500} unit="Hz" onChange={(v) => setRolloff({ ...rolloff, lowpassHz: v })} />
          </Module>

          <Module name="Noise reduction" enabled={noise.on} onToggle={(v) => setNoise({ ...noise, on: v })}>
            <Slider label="Strength" value={noise.strength} min={0} max={1} step={0.05} unit="" onChange={(v) => setNoise({ ...noise, strength: v })} />
          </Module>

          <Module name="Noise suppression (RNN)" enabled={rnn.on} onToggle={(v) => setRnn({ ...rnn, on: v })}>
            <Slider label="Mix" value={rnn.mix} min={0} max={1} step={0.05} unit="" onChange={(v) => setRnn({ ...rnn, mix: v })} />
          </Module>

          <Module name="Speech leveler" enabled={leveler.on} onToggle={(v) => setLeveler({ ...leveler, on: v })}>
            <Slider label="Strength" value={leveler.strength} min={0} max={1} step={0.05} unit="" onChange={(v) => setLeveler({ ...leveler, strength: v })} />
          </Module>

          <Module name="Equalizer" enabled={eq.on} onToggle={(v) => setEq({ ...eq, on: v })}>
            <Slider label="Bass" value={eq.bassDb} min={-15} max={15} step={0.5} unit="dB" onChange={(v) => setEq({ ...eq, bassDb: v })} />
            <Slider label="Mid" value={eq.midDb} min={-15} max={15} step={0.5} unit="dB" onChange={(v) => setEq({ ...eq, midDb: v })} />
            <Slider label="Treble" value={eq.trebleDb} min={-15} max={15} step={0.5} unit="dB" onChange={(v) => setEq({ ...eq, trebleDb: v })} />
          </Module>

          <Module name="De-esser" enabled={deesser.on} onToggle={(v) => setDeesser({ ...deesser, on: v })}>
            <Slider label="Intensity" value={deesser.intensity} min={0} max={1} step={0.05} unit="" onChange={(v) => setDeesser({ ...deesser, intensity: v })} />
          </Module>

          <Module name="Compressor" enabled={comp.on} onToggle={(v) => setComp({ ...comp, on: v })}>
            <Slider label="Threshold" value={comp.thresholdDb} min={-40} max={0} step={1} unit="dB" onChange={(v) => setComp({ ...comp, thresholdDb: v })} />
            <Slider label="Ratio" value={comp.ratio} min={1} max={20} step={0.5} unit=":1" onChange={(v) => setComp({ ...comp, ratio: v })} />
          </Module>

          <Module name="Gain" enabled={gain.on} onToggle={(v) => setGain({ ...gain, on: v })}>
            <Slider label="Gain" value={gain.db} min={-24} max={24} step={0.5} unit="dB" onChange={(v) => setGain({ ...gain, db: v })} />
          </Module>

          <Module name="Fades" enabled={fade.on} onToggle={(v) => setFade({ ...fade, on: v })}>
            <Slider label="Fade in" value={fade.inS} min={0} max={15} step={0.1} unit="s" onChange={(v) => setFade({ ...fade, inS: v })} />
            <Slider label="Fade out" value={fade.outS} min={0} max={15} step={0.1} unit="s" onChange={(v) => setFade({ ...fade, outS: v })} />
          </Module>

          <Module name="Loudness normalize (LUFS)" enabled={loud.on} onToggle={(v) => setLoud({ ...loud, on: v })}>
            <Slider label="Target" value={loud.targetLufs} min={-31} max={-9} step={1} unit=" LUFS" onChange={(v) => setLoud({ ...loud, targetLufs: v })} />
            <p className="text-[10px] text-[var(--color-muted)]">−14 social · −16 podcast · −23 broadcast</p>
          </Module>
        </div>

        {error ? <p className="shrink-0 text-[11px] text-[var(--color-danger)]">{error}</p> : null}
        <button
          type="button"
          onClick={apply}
          disabled={!selected || busy}
          className="shrink-0 rounded-md bg-[var(--color-accent)] px-3 py-2 font-medium text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Processing…" : "Apply → new track"}
        </button>
      </div>
    </PanelChrome>
  );
}
