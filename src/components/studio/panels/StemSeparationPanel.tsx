"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useAudioStudioStore } from "@/stores/audioStudioStore";
import { pollAudioJob } from "@/lib/audio/jobClient";

interface StemResult {
  name: string;
  relPath: string;
  url: string;
}

const MODELS = [
  { id: "htdemucs", label: "htdemucs — 4 stems (vocals · drums · bass · other)" },
  { id: "htdemucs_ft", label: "htdemucs_ft — 4 stems, fine-tuned (slower, cleaner)" },
  { id: "htdemucs_6s", label: "htdemucs_6s — 6 stems (+ guitar · piano)" },
];

export default function StemSeparationPanel({ windowControls }: PanelProps) {
  const tracks = useAudioStudioStore((s) => s.tracks);
  const selectedTrackId = useAudioStudioStore((s) => s.selectedTrackId);
  const select = useAudioStudioStore((s) => s.select);
  const addTracks = useAudioStudioStore((s) => s.addTracks);
  const projectId = useAudioStudioStore((s) => s.projectId);

  const selected = tracks.find((t) => t.id === selectedTrackId) ?? tracks[0] ?? null;
  const [model, setModel] = useState("htdemucs");
  const [karaoke, setKaraoke] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stems, setStems] = useState<StemResult[]>([]);
  const [sourceName, setSourceName] = useState("");

  async function run() {
    if (!selected || !projectId) return;
    setRunning(true);
    setError(null);
    setProgress(0);
    setStems([]);
    setMessage("Queued…");
    try {
      const { jobId } = await api<{ jobId: string }>("/api/audio/stems", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          path: selected.relPath,
          model,
          twoStems: karaoke ? "vocals" : null,
        }),
      });
      const job = await pollAudioJob(jobId, (j) => {
        setProgress(j.progress ?? 0);
        setMessage(j.message);
      });
      const resultStems = (job.result as StemResult[]) ?? [];
      setStems(resultStems);
      setSourceName(selected.name);
      addTracks(
        resultStems.map((s) => ({
          // Stem name first so it stays visible when the lane label truncates,
          // e.g. "Vocals · Daft Punk - Around the World".
          name: `${s.name.charAt(0).toUpperCase()}${s.name.slice(1)} · ${selected.name}`,
          relPath: s.relPath,
          url: s.url,
          durationS: selected.durationS,
          kind: "stem" as const,
        })),
      );
      setMessage(`Done — ${resultStems.length} stems added to the timeline.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <PanelChrome title="Stem Separation" icon="🎛" {...windowControls}>
      <div className="flex h-full flex-col gap-3 p-3 text-xs">
        <p className="text-[11px] text-[var(--color-muted)]">
          AI source separation via <span className="font-semibold text-[var(--color-fg)]">Demucs</span> — split a mixed track into isolated stems. Runs on the GPU when available.
        </p>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Source track</span>
          <select
            value={selected?.id ?? ""}
            onChange={(e) => select(e.target.value || null)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5"
          >
            {tracks.length === 0 ? <option value="">Import a track first</option> : null}
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5">
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={karaoke} onChange={(e) => setKaraoke(e.target.checked)} className="accent-[var(--color-accent)]" />
          Karaoke mode (vocals + instrumental only)
        </label>

        <button
          type="button"
          onClick={run}
          disabled={!selected || running}
          className="rounded-md bg-[var(--color-accent)] px-3 py-2 font-medium text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {running ? "Separating…" : "Separate stems"}
        </button>

        {running || message ? (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width]" style={{ width: `${Math.round((progress || 0) * 100)}%` }} />
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">{message}</p>
          </div>
        ) : null}

        {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}

        {stems.length > 0 ? (
          <div className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Stems — added to timeline · download below</span>
            <ul className="space-y-1">
              {stems.map((s) => (
                <li
                  key={s.relPath}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5"
                >
                  <span className="truncate capitalize">{s.name}</span>
                  <a
                    href={s.url}
                    download={`${(sourceName || "stem").replace(/\.[^.]+$/, "")}-${s.name}.wav`}
                    className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] font-medium transition hover:bg-[var(--color-border)]"
                  >
                    ⬇ Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-auto text-[10px] text-[var(--color-muted)]">
          First run downloads the model weights (~hundreds of MB) and can take a few minutes; later runs are faster.
        </p>
      </div>
    </PanelChrome>
  );
}
