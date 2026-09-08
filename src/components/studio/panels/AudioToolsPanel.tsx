"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { OptionDrawer } from "../OptionDrawer";
import { useAudioStudioStore, type AudioTrack } from "@/stores/audioStudioStore";
import { pollAudioJob } from "@/lib/audio/jobClient";

interface NewTrackResult {
  relPath: string;
  name: string;
  durationS: number;
  url: string;
  isVideo?: boolean;
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

type Tab = "duck" | "silence" | "stretch" | "audiogram" | "tempo" | "captions";

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

  // Stretch (Rubber Band)
  const [stretchId, setStretchId] = useState(selectedTrackId ?? "");
  const [stretchTempo, setStretchTempo] = useState(1);
  const [stretchSemis, setStretchSemis] = useState(0);

  // Audiogram
  const [agId, setAgId] = useState(selectedTrackId ?? "");
  const [agStyle, setAgStyle] = useState<"waves" | "spectrum" | "bars">("waves");
  const [agSize, setAgSize] = useState<"1280x720" | "1080x1080" | "1080x1920" | "1920x1080">("1280x720");
  const [agColor, setAgColor] = useState("#2ec5c5");
  const [agBg, setAgBg] = useState("#0b0d12");
  const [agOut, setAgOut] = useState<NewTrackResult | null>(null);
  const [agSent, setAgSent] = useState(false);

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

  async function runStretch() {
    const t = byId(stretchId);
    if (!t || !projectId) {
      setError("Pick a track.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<NewTrackResult>("/api/audio/tools", {
        method: "POST",
        body: JSON.stringify({ op: "stretch", projectId, path: t.relPath, tempo: stretchTempo, pitchSemitones: stretchSemis }),
      });
      added(res, "processed");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAudiogram() {
    const t = byId(agId);
    if (!t || !projectId) {
      setError("Pick a track.");
      return;
    }
    const [w, h] = agSize.split("x").map(Number);
    setBusy(true);
    setError(null);
    setAgOut(null);
    setAgSent(false);
    try {
      const res = await api<NewTrackResult>("/api/audio/tools", {
        method: "POST",
        body: JSON.stringify({ op: "audiogram", projectId, path: t.relPath, style: agStyle, width: w, height: h, color: agColor, background: agBg }),
      });
      setAgOut(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendAudiogramToBucket() {
    if (!agOut || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/audio/to-asset", { method: "POST", body: JSON.stringify({ projectId, relPath: agOut.relPath }) });
      setAgSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "duck", label: "Ducking" },
    { key: "silence", label: "Silence" },
    { key: "stretch", label: "Stretch" },
    { key: "audiogram", label: "Audiogram" },
    { key: "tempo", label: "Tempo" },
    { key: "captions", label: "Captions" },
  ];

  return (
    <PanelChrome title="Audio Tools" icon="🧰" {...windowControls}>
      <div className="flex h-full flex-col gap-2 p-3 text-xs">
        <OptionDrawer
          className="shrink-0"
          label="Tool"
          value={tab}
          options={TABS}
          onChange={(k) => setTab(k as Tab)}
        />

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

          {tab === "stretch" ? (
            <>
              <p className="text-[11px] text-[var(--color-muted)]">Change speed without changing pitch, or shift pitch without changing speed (Rubber Band).</p>
              <TrackSelect tracks={tracks} value={stretchId} onChange={setStretchId} placeholder="Select track…" />
              <label className="flex items-center gap-2">
                <span className="w-16 text-[var(--color-muted)]">Speed</span>
                <input type="range" min={0.5} max={2} step={0.05} value={stretchTempo} onChange={(e) => setStretchTempo(Number(e.target.value))} className="h-1 flex-1 accent-[var(--color-accent)]" />
                <span className="w-12 text-right font-mono tnum">{stretchTempo.toFixed(2)}×</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 text-[var(--color-muted)]">Pitch</span>
                <input type="range" min={-12} max={12} step={1} value={stretchSemis} onChange={(e) => setStretchSemis(Number(e.target.value))} className="h-1 flex-1 accent-[var(--color-accent)]" />
                <span className="w-12 text-right font-mono tnum">{stretchSemis > 0 ? "+" : ""}{stretchSemis} st</span>
              </label>
              <button type="button" onClick={runStretch} disabled={busy} className="w-full rounded-md bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-40">
                {busy ? "Stretching…" : "Stretch → new track"}
              </button>
            </>
          ) : null}

          {tab === "audiogram" ? (
            <>
              <p className="text-[11px] text-[var(--color-muted)]">Render this track as a waveform / spectrum video for podcast and social clips.</p>
              <TrackSelect tracks={tracks} value={agId} onChange={setAgId} placeholder="Select track…" />
              <div className="grid grid-cols-2 gap-2">
                <select value={agStyle} onChange={(e) => setAgStyle(e.target.value as "waves" | "spectrum" | "bars")} className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5">
                  <option value="waves">Waveform</option>
                  <option value="spectrum">Spectrum</option>
                  <option value="bars">Frequency bars</option>
                </select>
                <select value={agSize} onChange={(e) => setAgSize(e.target.value as typeof agSize)} className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5">
                  <option value="1280x720">1280 × 720</option>
                  <option value="1920x1080">1920 × 1080</option>
                  <option value="1080x1080">1080 × 1080 (square)</option>
                  <option value="1080x1920">1080 × 1920 (vertical)</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5"><span className="text-[var(--color-muted)]">Wave</span><input type="color" value={agColor} onChange={(e) => setAgColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-[var(--color-border)] bg-transparent" /></label>
                <label className="flex items-center gap-1.5"><span className="text-[var(--color-muted)]">Background</span><input type="color" value={agBg} onChange={(e) => setAgBg(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-[var(--color-border)] bg-transparent" /></label>
              </div>
              <button type="button" onClick={runAudiogram} disabled={busy} className="w-full rounded-md bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-40">
                {busy ? "Rendering…" : "Render audiogram video"}
              </button>
              {agOut ? (
                <div className="space-y-1.5 rounded-md border border-[var(--color-border)] p-2">
                  <div className="truncate text-[11px]">{agOut.name} · {agOut.durationS.toFixed(1)}s</div>
                  <div className="flex gap-1.5">
                    <a href={agOut.url} target="_blank" rel="noreferrer" className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-center text-[10px] hover:border-[var(--color-accent)]">Open</a>
                    <button type="button" disabled={busy || agSent} onClick={sendAudiogramToBucket} className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:border-[var(--color-accent)] disabled:opacity-40">
                      {agSent ? "In Media Bucket ✓" : "→ Media Bucket"}
                    </button>
                  </div>
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
