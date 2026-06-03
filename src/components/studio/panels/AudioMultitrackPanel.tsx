"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";
import { useAudioStudioStore, type AudioTrack } from "@/stores/audioStudioStore";
import { useStudioWorkspaceStore } from "@/stores/studioWorkspaceStore";
import { api } from "@/lib/api";
import { pollAudioJob } from "@/lib/audio/jobClient";
import { connectMediaElement, resumeAudio } from "@/lib/audio/visualizerBus";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WaveSurferInstance = any;

const LANE_H = 56;
const HEADER_W = 168;

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s * 100) % 100);
  return `${m}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Which tracks actually sound right now, honoring solo > mute. */
function audibleSet(tracks: AudioTrack[]): Set<string> {
  const soloed = tracks.filter((t) => t.solo);
  const pool = soloed.length ? soloed : tracks;
  return new Set(pool.filter((t) => !t.muted).map((t) => t.id));
}

export default function AudioMultitrackPanel({ windowControls, panelId }: PanelProps) {
  const { snapshot, insertAudioFromStudio, readOnly } = useProjectEditor();
  // Is this panel the front (active) window? Used to scope the spacebar shortcut.
  const isFront = useStudioWorkspaceStore((s) => {
    const me = s.windows.find((w) => w.id === panelId);
    if (!me || me.isMinimized) return false;
    return !s.windows.some((w) => !w.isMinimized && w.zIndex > me.zIndex);
  });
  const setProject = useAudioStudioStore((s) => s.setProject);
  useEffect(() => {
    setProject(snapshot.id);
  }, [snapshot.id, setProject]);

  const tracks = useAudioStudioStore((s) => s.tracks);
  const selectedTrackId = useAudioStudioStore((s) => s.selectedTrackId);
  const select = useAudioStudioStore((s) => s.select);
  const toggleMute = useAudioStudioStore((s) => s.toggleMute);
  const toggleSolo = useAudioStudioStore((s) => s.toggleSolo);
  const updateTrack = useAudioStudioStore((s) => s.updateTrack);
  const removeTrack = useAudioStudioStore((s) => s.removeTrack);
  const addTrack = useAudioStudioStore((s) => s.addTrack);
  const splitTrack = useAudioStudioStore((s) => s.splitTrack);

  const [pxPerSec, setPxPerSec] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  // "Send to Video Timeline" — ingest the whole arrangement as audio layers.
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");

  // Mixdown / export
  const [mixFmt, setMixFmt] = useState<"wav" | "mp3">("wav");
  const [mixing, setMixing] = useState(false);
  const [mixMsg, setMixMsg] = useState("");
  const [mixErr, setMixErr] = useState<string | null>(null);
  const [mixOut, setMixOut] = useState<{ url: string; name: string; fmt: string } | null>(null);

  // Per-lane tempo detection (librosa). Stores bpm + beat times on the track so
  // the timeline can show beat markers for alignment.
  const [tempoBusy, setTempoBusy] = useState<string | null>(null);
  async function measureTempo(t: AudioTrack) {
    if (tempoBusy) return;
    setTempoBusy(t.id);
    try {
      const res = await api<{ tempo: { bpm: number | null; beatsS: number[] } | null }>("/api/audio/analyze", {
        method: "POST",
        body: JSON.stringify({ projectId: snapshot.id, path: t.relPath, kinds: ["tempo"] }),
      });
      updateTrack(t.id, { bpm: res.tempo?.bpm ?? null, beats: res.tempo?.beatsS ?? [] });
    } catch {
      updateTrack(t.id, { bpm: null, beats: [] });
    } finally {
      setTempoBusy(null);
    }
  }

  async function mixDown() {
    if (!tracks.length || mixing) return;
    setMixing(true);
    setMixErr(null);
    setMixOut(null);
    setMixMsg("Queued…");
    try {
      const { jobId } = await api<{ jobId: string }>("/api/audio/mix", {
        method: "POST",
        body: JSON.stringify({
          projectId: snapshot.id,
          format: mixFmt,
          tracks: tracks.map((t) => ({
            relPath: t.relPath,
            volume: t.volume,
            muted: t.muted,
            solo: t.solo,
            offsetS: t.offsetS,
            trimStartS: t.trimStartS,
            durationS: t.durationS,
          })),
        }),
      });
      const job = await pollAudioJob(jobId, (j) => setMixMsg(j.message));
      const r = job.result as { name: string; relPath: string; durationS: number; url: string };
      addTrack({ name: r.name, relPath: r.relPath, url: r.url, durationS: r.durationS, kind: "mix" });
      setMixOut({ url: r.url, name: r.name, fmt: mixFmt });
      setMixMsg("");
    } catch (e) {
      setMixErr((e as Error).message);
    } finally {
      setMixing(false);
    }
  }

  // Drag a clip's body left/right to reposition it on the timeline (offsetS),
  // snapping to 0, the playhead, and other clips' edges for easy alignment.
  function startMove(e: React.MouseEvent, t: AudioTrack) {
    e.preventDefault();
    e.stopPropagation();
    select(t.id);
    const startX = e.clientX;
    const origOffset = t.offsetS;
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - startX) > 3) moved = true;
      if (!moved) return;
      // Free positioning — no snapping, so fine adjustments stay precise.
      updateTrack(t.id, { offsetS: Math.max(0, origOffset + (ev.clientX - startX) / pxPerSec) });
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // A pure click (no drag) seeks the playhead to where you clicked.
      if (!moved) seekTo(headFromClientX(ev.clientX));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Drag a clip's left/right edge to trim its in/out points (like video clips).
  function startTrim(e: React.MouseEvent, t: AudioTrack, edge: "left" | "right") {
    e.preventDefault();
    e.stopPropagation();
    select(t.id);
    const startX = e.clientX;
    const orig = { trimStartS: t.trimStartS, durationS: t.durationS, offsetS: t.offsetS };
    const MIN = 0.1;
    const onMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) / pxPerSec;
      if (edge === "right") {
        const maxDur = t.sourceDurationS - orig.trimStartS;
        updateTrack(t.id, { durationS: Math.min(maxDur, Math.max(MIN, orig.durationS + delta)) });
      } else {
        // Left edge: move the in-point and the timeline position together so the
        // content under the cursor stays put and the right edge is fixed.
        const dMin = Math.max(-orig.trimStartS, -orig.offsetS);
        const dMax = orig.durationS - MIN;
        const d = Math.min(dMax, Math.max(dMin, delta));
        updateTrack(t.id, {
          trimStartS: orig.trimStartS + d,
          durationS: orig.durationS - d,
          offsetS: orig.offsetS + d,
        });
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const wsMap = useRef<Map<string, WaveSurferInstance>>(new Map());
  const laneRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef<{ at: number; head: number } | null>(null);
  // Holds the latest `tick` so the rAF loop can recurse without `tick`
  // referencing itself (which the linter flags as use-before-declare).
  const tickRef = useRef<() => void>(() => {});
  // The timeline content element (width = total*pxPerSec) — used to map a click's
  // clientX to a timeline position.
  const contentRef = useRef<HTMLDivElement | null>(null);

  const total = tracks.reduce((m, t) => Math.max(m, t.offsetS + t.durationS), 0) || 10;

  const headFromClientX = useCallback(
    (clientX: number) => {
      const el = contentRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return Math.max(0, (clientX - rect.left) / pxPerSec);
    },
    [pxPerSec],
  );

  // Build / tear down a WaveSurfer per track as the track list changes.
  useEffect(() => {
    let cancelled = false;
    const map = wsMap.current;

    (async () => {
      const mod = await import("wavesurfer.js");
      if (cancelled) return;
      const WaveSurfer = mod.default;

      // Remove instances for tracks that are gone.
      for (const [id, ws] of map) {
        if (!tracks.find((t) => t.id === id)) {
          try {
            ws.destroy();
          } catch {
            /* ignore */
          }
          map.delete(id);
        }
      }

      // Create instances for new tracks.
      for (const t of tracks) {
        if (map.has(t.id)) continue;
        const container = laneRefs.current.get(t.id);
        if (!container) continue;
        const ws = WaveSurfer.create({
          container,
          url: t.url,
          height: LANE_H - 16,
          // Semi-transparent so lanes read as soft/hazy (glow added on the clip).
          waveColor: `${t.color}80`,
          progressColor: `${t.color}b3`,
          cursorColor: "transparent",
          normalize: true,
          interact: false,
          dragToSeek: false,
        });
        ws.setVolume(t.muted ? 0 : t.volume);
        // Route this lane into the shared analyser bus so the Visualizer can
        // render the combined multitrack output.
        try {
          connectMediaElement(ws.getMediaElement?.());
        } catch {
          /* ignore */
        }
        map.set(t.id, ws);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map((t) => `${t.id}:${t.url}`).join("|")]);

  // Destroy everything on unmount.
  useEffect(() => {
    const map = wsMap.current;
    return () => {
      for (const ws of map.values()) {
        try {
          ws.destroy();
        } catch {
          /* ignore */
        }
      }
      map.clear();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Keep per-lane gain in sync with mute/solo/volume even mid-playback.
  useEffect(() => {
    const audible = audibleSet(tracks);
    for (const t of tracks) {
      const ws = wsMap.current.get(t.id);
      if (ws) {
        try {
          ws.setVolume(audible.has(t.id) ? t.volume : 0);
        } catch {
          /* ignore */
        }
      }
    }
  }, [tracks]);

  // The selected lane's waveform brightens to full opacity (others stay hazy) —
  // a clear visual cue for what's selected.
  useEffect(() => {
    for (const t of tracks) {
      const ws = wsMap.current.get(t.id);
      if (!ws) continue;
      const sel = t.id === selectedTrackId;
      try {
        ws.setOptions({
          waveColor: sel ? t.color : `${t.color}80`,
          progressColor: sel ? t.color : `${t.color}b3`,
        });
      } catch {
        /* ignore — older wavesurfer */
      }
    }
  }, [tracks, selectedTrackId]);

  const stopRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const pauseAll = useCallback(() => {
    for (const ws of wsMap.current.values()) {
      try {
        ws.pause();
      } catch {
        /* ignore */
      }
    }
    stopRaf();
    playStartRef.current = null;
    setPlaying(false);
  }, []);

  const seekTo = useCallback(
    (head: number) => {
      head = Math.max(0, head);
      setPlayhead(head);
      const playingNow = playStartRef.current != null;
      const audible = audibleSet(tracks);
      for (const t of tracks) {
        const ws = wsMap.current.get(t.id);
        if (!ws) continue;
        const local = head - t.offsetS;
        const inWindow = local >= 0 && local <= t.durationS;
        try {
          ws.setTime(inWindow ? t.trimStartS + local : t.trimStartS);
          if (playingNow) {
            // Re-sync lanes so playback continues from the new position.
            if (inWindow && audible.has(t.id)) {
              ws.setVolume(t.volume);
              if (ws.isPlaying?.() === false) ws.play();
            } else {
              ws.setVolume(0);
              if (ws.isPlaying?.()) ws.pause();
            }
          }
        } catch {
          /* ignore */
        }
      }
      // Rebase the play clock so the rAF tick keeps time from here.
      if (playStartRef.current) playStartRef.current = { at: performance.now(), head };
    },
    [tracks],
  );

  const tick = useCallback(() => {
    const ref = playStartRef.current;
    if (!ref) return;
    const elapsed = (performance.now() - ref.at) / 1000;
    const head = ref.head + elapsed;
    setPlayhead(head);

    const audible = audibleSet(tracks);
    for (const t of tracks) {
      const ws = wsMap.current.get(t.id);
      if (!ws) continue;
      const local = head - t.offsetS;
      const inWindow = local >= 0 && local <= t.durationS;
      try {
        ws.setVolume(inWindow && audible.has(t.id) ? t.volume : 0);
        if (inWindow && ws.isPlaying?.() === false) {
          try { ws.setTime(t.trimStartS + Math.max(0, local)); } catch { /* ignore */ }
          ws.play();
        }
        if (!inWindow && ws.isPlaying?.()) ws.pause();
      } catch {
        /* ignore */
      }
    }

    if (head >= total) {
      pauseAll();
      seekTo(0);
      return;
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, [tracks, total, pauseAll, seekTo]);

  // Keep the rAF indirection pointed at the current tick closure.
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const playAll = useCallback(() => {
    if (!tracks.length) return;
    resumeAudio(); // unlock the shared AudioContext on this user gesture
    playStartRef.current = { at: performance.now(), head: playhead >= total ? 0 : playhead };
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tracks.length, playhead, total, tick]);

  const togglePlay = useCallback(() => {
    if (!tracks.length) return;
    if (playStartRef.current) pauseAll();
    else playAll();
  }, [tracks.length, pauseAll, playAll]);

  // Multiplicative zoom with a very wide range (px per second of audio).
  const zoomIn = useCallback(() => setPxPerSec((z) => Math.min(5000, z * 1.3)), []);
  const zoomOut = useCallback(() => setPxPerSec((z) => Math.max(0.2, z / 1.3)), []);

  // Spacebar toggles multitrack playback when this panel is the active window.
  // Capture phase + stopImmediatePropagation so the global (video preview)
  // Space handler doesn't also fire.
  useEffect(() => {
    if (!isFront) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || el?.isContentEditable) return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
        togglePlay();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        e.stopImmediatePropagation();
        zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        e.stopImmediatePropagation();
        zoomOut();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isFront, togglePlay, zoomIn, zoomOut]);

  const onRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    seekTo(headFromClientX(e.clientX));
  };

  // Push the whole multitrack arrangement onto the Video timeline: each track
  // becomes an audio-only clip on its own audio layer, preserving offset + trim.
  // This is the bridge that makes the Audio Studio and Assembly one timeline.
  async function sendToTimeline() {
    if (readOnly || sending || tracks.length === 0) return;
    setSending(true);
    setSendMsg("");
    try {
      let lane = 0;
      for (const t of tracks) {
        await insertAudioFromStudio(
          { relPath: t.relPath, trimStartS: t.trimStartS, durationS: t.durationS },
          t.offsetS,
          lane,
        );
        lane += 1;
      }
      setSendMsg(`Added ${tracks.length} layer${tracks.length === 1 ? "" : "s"} to the Video timeline`);
    } catch (e) {
      setSendMsg(e instanceof Error ? e.message : "Failed to send to timeline");
    } finally {
      setSending(false);
    }
  }

  return (
    <PanelChrome title="Multitrack Timeline" icon="▤" {...windowControls}>
      <div className="flex h-full flex-col">
        {/* Transport */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2 py-1.5">
          <button
            type="button"
            onClick={() => (playing ? pauseAll() : playAll())}
            disabled={!tracks.length}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)] text-white disabled:opacity-30"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => {
              pauseAll();
              seekTo(0);
            }}
            disabled={!tracks.length}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-30"
            title="Stop"
          >
            ◼
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedTrackId) splitTrack(selectedTrackId, playhead);
            }}
            disabled={!selectedTrackId}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-30"
            title="Split selected track at playhead"
          >
            ✂
          </button>
          <span className="ml-1 font-mono tnum text-xs text-[var(--color-muted)]">
            {fmtTime(playhead)} / {fmtTime(total)}
          </span>
          <button
            type="button"
            onClick={sendToTimeline}
            disabled={readOnly || sending || tracks.length === 0}
            title="Add this arrangement to the Video timeline as audio layers"
            className="ml-auto rounded border border-white/70 px-2 py-0.5 text-[11px] text-white hover:bg-white/10 disabled:opacity-40"
          >
            {sending ? "Sending…" : "→ Timeline"}
          </button>
          <div className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
            <span>Zoom</span>
            <button type="button" className="rounded border border-[var(--color-border)] px-1.5 hover:text-[var(--color-fg)]" onClick={zoomOut} title="Zoom out ( - )">
              −
            </button>
            <button type="button" className="rounded border border-[var(--color-border)] px-1.5 hover:text-[var(--color-fg)]" onClick={zoomIn} title="Zoom in ( + )">
              +
            </button>
          </div>
        </div>

        {tracks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-muted)]">
            Import audio (Audio Importer) or run Stem Separation — lanes appear here.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex">
              {/* Lane headers (fixed) */}
              <div className="shrink-0" style={{ width: HEADER_W }}>
                <div className="h-5 border-b border-[var(--color-border)] bg-[var(--color-surface)]" />
                {tracks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => select(t.id)}
                    className={`flex flex-col justify-center gap-1 border-b border-[var(--color-border)] px-2 py-1 ${
                      selectedTrackId === t.id ? "bg-[var(--color-accent)]/10" : ""
                    }`}
                    style={{ height: LANE_H }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{t.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrack(t.id);
                        }}
                        className="text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                        title="Remove lane"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute(t.id);
                        }}
                        className={`rounded px-1 text-[9px] font-bold ${t.muted ? "bg-[var(--color-danger)] text-white" : "border border-[var(--color-border)] text-[var(--color-muted)]"}`}
                      >
                        M
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSolo(t.id);
                        }}
                        className={`rounded px-1 text-[9px] font-bold ${t.solo ? "bg-[var(--color-warning)] text-black" : "border border-[var(--color-border)] text-[var(--color-muted)]"}`}
                      >
                        S
                      </button>
                      <div className="flex flex-col items-center leading-none">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void measureTempo(t);
                          }}
                          disabled={tempoBusy === t.id}
                          title="Measure tempo (BPM) + show beat markers"
                          className="rounded border border-[var(--color-border)] px-1 text-[9px] font-bold text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
                        >
                          {tempoBusy === t.id ? "…" : "♩"}
                        </button>
                        {t.bpm ? (
                          <span className="mt-px text-[8px] leading-none text-[var(--color-accent)]" title="Detected BPM">
                            {Math.round(t.bpm)}
                          </span>
                        ) : null}
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.01}
                        value={t.volume}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateTrack(t.id, { volume: Number(e.target.value) })}
                        className="h-1 w-12 accent-[var(--color-accent)]"
                        title="Lane volume"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Waveform lanes (scroll with the timeline) */}
              <div ref={contentRef} className="relative min-w-0 flex-1">
                {/* Ruler */}
                <div
                  className="relative h-5 cursor-pointer border-b border-[var(--color-border)] bg-[var(--color-surface)]"
                  style={{ width: total * pxPerSec }}
                  onMouseDown={onRulerMouseDown}
                >
                  {Array.from({ length: Math.ceil(total) + 1 }).map((_, i) => (
                    <div key={i} className="absolute top-0 h-full border-l border-[var(--color-border)] pl-0.5 text-[8px] text-[var(--color-muted)]" style={{ left: i * pxPerSec }}>
                      {i % 5 === 0 ? `${i}s` : ""}
                    </div>
                  ))}
                </div>

                {tracks.map((t) => {
                  const clipW = Math.max(8, t.durationS * pxPerSec);
                  const fullW = Math.max(8, t.sourceDurationS * pxPerSec);
                  return (
                    <div
                      key={t.id}
                      className="relative border-b border-[var(--color-border)]"
                      style={{ height: LANE_H, width: total * pxPerSec }}
                      onMouseDown={(e) => {
                        if (e.target === e.currentTarget) seekTo(headFromClientX(e.clientX));
                      }}
                    >
                      <div
                        onMouseDown={(e) => startMove(e, t)}
                        className={`group absolute top-2 cursor-grab overflow-hidden rounded active:cursor-grabbing ${selectedTrackId === t.id ? "ring-1 ring-[var(--color-accent)]" : ""}`}
                        style={{
                          left: t.offsetS * pxPerSec,
                          width: clipW,
                          height: LANE_H - 16,
                          // Soft haze in the lane colour so the waveform appears to glow;
                          // the selected lane brightens and glows harder as a selection cue.
                          filter:
                            selectedTrackId === t.id
                              ? `brightness(1.35) drop-shadow(0 0 5px ${t.color}) drop-shadow(0 0 16px ${t.color})`
                              : `drop-shadow(0 0 3px ${t.color}) drop-shadow(0 0 9px ${t.color}66)`,
                        }}
                      >
                        {/* Full-source waveform, shifted so only the trimmed window shows. */}
                        <div
                          ref={(el) => {
                            laneRefs.current.set(t.id, el);
                          }}
                          style={{ width: fullW, transform: `translateX(${-t.trimStartS * pxPerSec}px)` }}
                        />
                        {/* Trim handles (drag to shorten / set in-out points). */}
                        <div
                          onMouseDown={(e) => startTrim(e, t, "left")}
                          className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-transparent hover:bg-[var(--color-accent)]/60"
                          title="Trim start"
                        />
                        <div
                          onMouseDown={(e) => startTrim(e, t, "right")}
                          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-transparent hover:bg-[var(--color-accent)]/60"
                          title="Trim end"
                        />
                      </div>
                      {/* Beat markers (downward arrows) at detected beats, for alignment. */}
                      {(t.beats ?? []).map((b, i) => {
                        const local = b - t.trimStartS;
                        if (local < 0 || local > t.durationS) return null;
                        return (
                          <span
                            key={i}
                            className="pointer-events-none absolute top-0 z-20 -translate-x-1/2 text-[8px] leading-none text-[var(--color-accent)]"
                            style={{ left: (t.offsetS + local) * pxPerSec }}
                          >
                            ▾
                          </span>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Playhead */}
                <div
                  className="pointer-events-none absolute top-0 z-10 w-px bg-[var(--color-accent)]"
                  style={{ left: playhead * pxPerSec, height: 20 + tracks.length * LANE_H }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Mixdown / export */}
        <div className="shrink-0 border-t border-[var(--color-border)] px-2 py-1.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[var(--color-muted)]">Mix down</span>
            <select
              value={mixFmt}
              onChange={(e) => setMixFmt(e.target.value === "mp3" ? "mp3" : "wav")}
              className="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-0.5"
              title="Export format"
            >
              <option value="wav">WAV</option>
              <option value="mp3">MP3</option>
            </select>
            <button
              type="button"
              onClick={mixDown}
              disabled={!tracks.length || mixing}
              className="rounded-md bg-[var(--color-accent)] px-3 py-1 font-medium text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {mixing ? "Mixing…" : `Mix down → ${mixFmt.toUpperCase()}`}
            </button>
            {mixOut ? (
              <a
                href={mixOut.url}
                download={`${mixOut.name}.${mixOut.fmt}`}
                className="ml-auto rounded-md border border-[var(--color-border)] px-2 py-1 font-medium transition hover:bg-[var(--color-border)]"
              >
                ⬇ Download {mixOut.fmt.toUpperCase()}
              </a>
            ) : null}
          </div>
          {sendMsg ? <p className="mt-1 text-[var(--color-muted)]">{sendMsg}</p> : null}
          {mixMsg ? <p className="mt-1 text-[var(--color-muted)]">{mixMsg}</p> : null}
          {mixErr ? <p className="mt-1 text-[var(--color-danger)]">{mixErr}</p> : null}
          {mixOut && !mixMsg ? (
            <p className="mt-1 text-[var(--color-muted)]">Added “{mixOut.name}” as a new track · honors mute/solo &amp; lane volume.</p>
          ) : null}
        </div>
      </div>
    </PanelChrome>
  );
}
