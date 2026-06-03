"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useAudioStudioStore, type AudioTrack } from "@/stores/audioStudioStore";
import { pollAudioJob } from "@/lib/audio/jobClient";

interface NewTrackResult {
  relPath: string;
  name: string;
  durationS: number;
  url: string;
}
interface TempoReport {
  bpm: number | null;
  beatsS: number[];
}
interface TranscribeResult {
  language: string | null;
  text: string;
  segments: { startS: number; endS: number; text: string }[];
  srt: string | null;
  vtt: string | null;
}

type Tab = "duck" | "silence" | "tempo" | "captions";

function TrackSelect({
  tracks,
  value,
  onChange,
  placeholder,
}: {
  tracks: AudioTrack[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-xs">
      <option value="">{placeholder}</option>
      {tracks.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export default function AudioToolsPanel({ windowControls }: PanelProps) {
  const tracks = useAudioStudioStore((s) => s.tracks);
  const addTrack = useAudioStudioStore((s) => s.addTrack);
  const projectId = useAudioStudioStore((s) => s.projectId);
  const selectedTrackId = useAudioStudioStore((s) => s.selectedTrackId);
  const byId = (id: string) => tracks.find((t) => t.id === id) ?? null;

  const [tab, setTab] = useState<Tab>("duck");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ducking
  const [musicId, setMusicId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [reduction, setReduction] = useState(12);

  // Silence
  const [silenceId, setSilenceId] = useState(selectedTrackId ?? "");
  const [thresholdDb, setThresholdDb] = useState(-40);

  // Tempo
  const [tempoId, setTempoId] = useState(selectedTrackId ?? "");
  const [tempo, setTempo] = useState<TempoReport | null>(null);

  // Captions
  const [capId, setCapId] = useState(selectedTrackId ?? "");
  const [capModel, setCapModel] = useState("base");
  const [capProgress, setCapProgress] = useState(0);
  const [capMsg, setCapMsg] = useState("");
  const [transcript, setTranscript] = useState<TranscribeResult | null>(null);

  function added(res: NewTrackResult, kind: "mix" | "processed") {
    addTrack({ name: res.name, relPath: res.relPath, url: res.url, durationS: res.durationS, kind });
  }

  async function runDuck() {
    const music = byId(musicId);
    const voice = byId(voiceId);
    if (!music || !voice || !projectId) {
      setError("Pick both a music and a voice track.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<NewTrackResult>("/api/audio/tools", {
        method: "POST",
        body: JSON.stringify({ op: "duck", projectId, musicPath: music.relPath, voicePath: voice.relPath, reductionDb: reduction }),
      });
      added(res, "mix");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runSilence() {
    const t = byId(silenceId);
    if (!t || !projectId) {
      setError("Pick a track.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<NewTrackResult>("/api/audio/tools", {
        method: "POST",
        body: JSON.stringify({ op: "trim-silence", projectId, path: t.relPath, thresholdDb }),
      });
      added(res, "processed");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runTempo() {
    const t = byId(tempoId);
    if (!t || !projectId) {
      setError("Pick a track.");
      return;
    }
    setBusy(true);
    setError(null);
    setTempo(null);
    try {
      const res = await api<{ tempo: TempoReport }>("/api/audio/analyze", {
        method: "POST",
        body: JSON.stringify({ projectId, path: t.relPath, kinds: ["tempo"] }),
      });
      setTempo(res.tempo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runCaptions() {
    const t = byId(capId);
    if (!t || !projectId) {
      setError("Pick a track.");
      return;
    }
    setBusy(true);
    setError(null);
    setTranscript(null);
    setCapProgress(0);
    setCapMsg("Queued…");
    try {
      const { jobId } = await api<{ jobId: string }>("/api/audio/transcribe", {
        method: "POST",
        body: JSON.stringify({ projectId, path: t.relPath, model: capModel }),
      });
      const job = await pollAudioJob(jobId, (j) => {
        setCapProgress(j.progress ?? 0);
        setCapMsg(j.message);
      });
      setTranscript(job.result as TranscribeResult);
      setCapMsg("Done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download(name: string, content: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "duck", label: "Ducking" },
    { key: "silence", label: "Silence" },
    { key: "tempo", label: "Tempo" },
    { key: "captions", label: "Captions" },
  ];

  return (
    <PanelChrome title="Audio Tools" icon="🧰" {...windowControls}>
      <div className="flex h-full flex-col gap-2 p-3 text-xs">
        <div className="flex shrink-0 overflow-hidden rounded-md border border-[var(--color-border)]">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-1 text-[10px] ${tab === t.key ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto">
          {tab === "duck" ? (
            <>
              <p className="text-[11px] text-[var(--color-muted)]">Auto-dip a music bed under a voice track (sidechain compression), then mix them.</p>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Music bed</span>
              <TrackSelect tracks={tracks} value={musicId} onChange={setMusicId} placeholder="Select music…" />
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Voice (key)</span>
              <TrackSelect tracks={tracks} value={voiceId} onChange={setVoiceId} placeholder="Select voice…" />
              <label className="flex items-center gap-2">
                <span className="w-16 text-[var(--color-muted)]">Duck by</span>
                <input type="range" min={3} max={30} step={1} value={reduction} onChange={(e) => setReduction(Number(e.target.value))} className="h-1 flex-1 accent-[var(--color-accent)]" />
                <span className="w-10 text-right font-mono tnum">{reduction}dB</span>
              </label>
              <button type="button" onClick={runDuck} disabled={busy} className="w-full rounded-md bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-40">
                {busy ? "Mixing…" : "Duck & mix → new track"}
              </button>
            </>
          ) : null}

          {tab === "silence" ? (
            <>
              <p className="text-[11px] text-[var(--color-muted)]">Strip dead air from the start, end, and gaps.</p>
              <TrackSelect tracks={tracks} value={silenceId} onChange={setSilenceId} placeholder="Select track…" />
              <label className="flex items-center gap-2">
                <span className="w-16 text-[var(--color-muted)]">Threshold</span>
                <input type="range" min={-70} max={-20} step={1} value={thresholdDb} onChange={(e) => setThresholdDb(Number(e.target.value))} className="h-1 flex-1 accent-[var(--color-accent)]" />
                <span className="w-12 text-right font-mono tnum">{thresholdDb}dB</span>
              </label>
              <button type="button" onClick={runSilence} disabled={busy} className="w-full rounded-md bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-40">
                {busy ? "Trimming…" : "Trim silence → new track"}
              </button>
            </>
          ) : null}

          {tab === "tempo" ? (
            <>
              <p className="text-[11px] text-[var(--color-muted)]">Estimate tempo and beat grid with librosa.</p>
              <TrackSelect tracks={tracks} value={tempoId} onChange={setTempoId} placeholder="Select track…" />
              <button type="button" onClick={runTempo} disabled={busy} className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 font-medium hover:border-[var(--color-accent)] disabled:opacity-40">
                {busy ? "Analyzing…" : "Detect tempo"}
              </button>
              {tempo ? (
                <div className="rounded-md border border-[var(--color-border)] p-3 text-center">
                  <div className="font-mono tnum text-2xl font-semibold">{tempo.bpm ?? "—"}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">BPM · {tempo.beatsS.length} beats</div>
                </div>
              ) : null}
            </>
          ) : null}

          {tab === "captions" ? (
            <>
              <p className="text-[11px] text-[var(--color-muted)]">Transcribe speech to captions with Whisper.</p>
              <TrackSelect tracks={tracks} value={capId} onChange={setCapId} placeholder="Select track…" />
              <label className="flex items-center gap-2">
                <span className="w-16 text-[var(--color-muted)]">Model</span>
                <select value={capModel} onChange={(e) => setCapModel(e.target.value)} className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1">
                  {["tiny", "base", "small", "medium", "large-v3"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={runCaptions} disabled={busy} className="w-full rounded-md bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-40">
                {busy ? "Transcribing…" : "Transcribe"}
              </button>
              {busy && tab === "captions" ? (
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.round(capProgress * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-[var(--color-muted)]">{capMsg}</p>
                </div>
              ) : null}
              {transcript ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button type="button" disabled={!transcript.srt} onClick={() => download("captions.srt", transcript.srt ?? "")} className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:border-[var(--color-accent)] disabled:opacity-40">
                      Download .srt
                    </button>
                    <button type="button" disabled={!transcript.vtt} onClick={() => download("captions.vtt", transcript.vtt ?? "")} className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:border-[var(--color-accent)] disabled:opacity-40">
                      Download .vtt
                    </button>
                  </div>
                  <div className="max-h-40 overflow-auto rounded-md border border-[var(--color-border)] p-2 text-[11px] leading-relaxed">
                    {transcript.segments.length ? (
                      transcript.segments.map((s, i) => (
                        <p key={i}>
                          <span className="font-mono tnum text-[var(--color-muted)]">{s.startS.toFixed(1)}s</span> {s.text}
                        </p>
                      ))
                    ) : (
                      <p className="text-[var(--color-muted)]">{transcript.text || "(no speech detected)"}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {error ? <p className="shrink-0 text-[11px] text-[var(--color-danger)]">{error}</p> : null}
      </div>
    </PanelChrome>
  );
}
