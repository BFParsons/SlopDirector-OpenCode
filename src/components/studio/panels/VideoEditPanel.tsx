"use client";

import { useRef, useState } from "react";
import { withBase } from "@/lib/basePath";
import { hasMediaDrag, readMediaDrag, setMediaDrag } from "@/lib/studio/dnd";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

function clock(t: number): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
}

/**
 * Source Monitor / Video Edit — load a source video, mark an In and an Out with
 * two sliders on the scrub bar, and add that subclip to the main timeline (a new
 * V1 clip trimmed to [In, Out]). Reuses insertMedia with trimStartS/durationS.
 *
 * The panel has no picker of its own: a source arrives only by dragging a clip
 * from the Media Bucket onto it, or via the Media Bucket's right-click
 * "Open in Video Edit" (both route through openInVideoEdit → videoEditSourceId).
 */
export default function VideoEditPanel({ windowControls }: PanelProps) {
  const { readOnly, videoEditSourceId, openInVideoEdit } = useProjectEditor();
  const sourceId = videoEditSourceId;

  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inS, setInS] = useState(0);
  const [outS, setOutS] = useState(0);
  const [vol, setVol] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const src = sourceId ? withBase(`/api/assets/${sourceId}`) : null;
  const subDur = Math.max(0, outS - inS);
  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);
  // A clip is "configured" once it has a loaded source and a non-trivial range;
  // then the display can be dragged to the timeline (Premiere source-monitor).
  const configured = !!sourceId && duration > 0 && subDur >= 0.1 && !readOnly;

  function onLoadedMeta() {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    setInS(0);
    setOutS(d);
    setTime(0);
    v.volume = vol;
  }

  function applyVol(next: number) {
    const c = Math.max(0, Math.min(1, next));
    setVol(c);
    if (videoRef.current) videoRef.current.volume = c;
  }

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }

  function play() {
    void videoRef.current?.play().catch(() => {});
  }
  function pause() {
    videoRef.current?.pause();
  }

  function dragMarker(which: "in" | "out") {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const at = (clientX: number) =>
        Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
      const move = (ev: PointerEvent) => {
        const t = at(ev.clientX);
        if (which === "in") setInS(Math.min(t, outS - 0.1));
        else setOutS(Math.max(t, inS + 0.1));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
  }

  const ioBtn =
    "flex h-5 items-center justify-center rounded border border-[var(--color-border)] px-1.5 text-[11px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] disabled:opacity-40";

  return (
    <PanelChrome title="Video Edit" icon="✂" {...windowControls}>
      <div
        className="flex h-full flex-col gap-2 p-2"
        onDragOver={(e) => {
          if (!hasMediaDrag(e.dataTransfer)) return;
          // Must set dropEffect every dragover or Chrome resolves it to "none"
          // and refuses the drop (onDrop never fires) — matches the Timeline.
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          setDragOver(false);
          const p = readMediaDrag(e.dataTransfer);
          if (p?.isVideo) {
            e.preventDefault();
            openInVideoEdit(p.id);
          }
        }}
      >
        <div
          draggable={configured}
          onDragStart={(e) => {
            if (!configured || !sourceId) {
              e.preventDefault();
              return;
            }
            setMediaDrag(e.dataTransfer, {
              id: sourceId,
              isVideo: true,
              trimStartS: Math.round(inS * 10) / 10,
              durationS: Math.round(subDur * 10) / 10,
            });
          }}
          className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-black ${
            dragOver ? "ring-2 ring-inset ring-[var(--color-accent)]" : ""
          } ${configured ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          {src ? (
            <video
              key={src}
              ref={videoRef}
              src={src}
              playsInline
              draggable={false}
              onLoadedMetadata={onLoadedMeta}
              onTimeUpdate={() => setTime(videoRef.current?.currentTime ?? 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={toggle}
              className="pointer-events-auto max-h-full max-w-full"
            />
          ) : (
            <p className="px-4 text-center text-xs text-[var(--color-muted)]">
              Drag a video from the Media Bucket here — or right-click a clip there and choose
              “Open in Video Edit” — to mark a subclip.
            </p>
          )}
          {configured ? (
            <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/85">
              ↧ Drag to timeline
            </div>
          ) : null}
        </div>

        {src && duration > 0 ? (
          <div className="shrink-0 space-y-1.5">
            {/* Scrub bar with In/Out markers */}
            <div
              ref={barRef}
              onClick={(e) => {
                const v = videoRef.current;
                const rect = barRef.current?.getBoundingClientRect();
                if (v && rect && rect.width) {
                  v.currentTime = Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration));
                }
              }}
              className="relative mx-1 h-2 cursor-pointer rounded bg-[var(--color-surface)]"
            >
              <div
                className="absolute inset-y-0 bg-[var(--color-accent)]/30"
                style={{ left: `${pct(inS)}%`, width: `${Math.max(0, pct(outS) - pct(inS))}%` }}
              />
              <div className="absolute inset-y-[-3px] w-0.5 bg-white" style={{ left: `${pct(time)}%` }} />
              {/* Clip-start marker: green ▼ triangle, apex on the bar */}
              <div
                onPointerDown={dragMarker("in")}
                onClick={(e) => e.stopPropagation()}
                title="Clip start (In) — drag"
                className="absolute top-[-9px] -translate-x-1/2 cursor-ew-resize px-1"
                style={{ left: `${pct(inS)}%` }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "9px solid var(--color-success)",
                  }}
                />
              </div>
              {/* Clip-end marker: red ▼ triangle, apex on the bar */}
              <div
                onPointerDown={dragMarker("out")}
                onClick={(e) => e.stopPropagation()}
                title="Clip end (Out) — drag"
                className="absolute top-[-9px] -translate-x-1/2 cursor-ew-resize px-1"
                style={{ left: `${pct(outS)}%` }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "9px solid var(--color-danger)",
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button type="button" className={ioBtn} title="Play" aria-label="Play" disabled={playing} onClick={play}>
                ▶
              </button>
              <button type="button" className={ioBtn} title="Pause" aria-label="Pause" disabled={!playing} onClick={pause}>
                ❚❚
              </button>
              <button
                type="button"
                className={ioBtn}
                title={vol === 0 ? "Unmute" : "Mute"}
                aria-label={vol === 0 ? "Unmute" : "Mute"}
                onClick={() => applyVol(vol === 0 ? 1 : 0)}
              >
                {vol === 0 ? "🔇" : "🔊"}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vol}
                onChange={(e) => applyVol(Number(e.target.value))}
                title="Volume"
                aria-label="Volume"
                className="h-1 w-12 accent-[var(--color-fg)]"
              />
              <span className="ml-auto truncate font-mono tnum text-[10px] text-[var(--color-muted)]">
                {clock(inS)}–{clock(outS)} · {subDur.toFixed(1)}s
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </PanelChrome>
  );
}
