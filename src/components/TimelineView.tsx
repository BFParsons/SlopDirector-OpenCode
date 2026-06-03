"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { withBase } from "@/lib/basePath";
import { api } from "@/lib/api";
import { Waveform } from "@/components/studio/Waveform";
import { hasMediaDrag, type MediaDragPayload, readMediaDrag, hasAudioDrag, readAudioDrag, type AudioStudioDragPayload } from "@/lib/studio/dnd";
import { fmtClock, segmentHue, type SegmentView } from "./SegmentCard";
import type { OverlayView } from "./AudioSection";

const MIN_PPS = 12;
const MAX_PPS = 240;
const NICE_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const SNAP_PX = 8; // edges snap to a boundary/playhead within this many pixels
const MIN_TRACK_H = 32;
const MAX_TRACK_H = 220;

function shortLabel(s: SegmentView): string {
  if (s.title?.trim()) return s.title;
  if (s.importUrl) return "YouTube";
  switch (s.source) {
    case "AI_GENERATED":
      return "AI clip";
    case "UPLOAD_VIDEO":
      return "Video";
    case "UPLOAD_IMAGE_STILL":
      return "Photo";
    case "UPLOAD_IMAGE_DRIVER":
      return "Photo → AI";
    default:
      return "Clip";
  }
}

function blockBg(hue: string): string {
  return `linear-gradient(165deg, color-mix(in srgb, ${hue}, #ffffff 12%) 0%, ${hue} 45%, color-mix(in srgb, ${hue}, #000000 32%) 100%)`;
}

/** A preview frame for a clip block: an uploaded image directly, or a video's
 *  first frame as a poster. None while an AI clip is still being generated. */
function thumbOf(s: SegmentView): { kind: "image" | "video"; id: string } | null {
  const ready = s.status === "READY";
  if ((s.source === "AI_GENERATED" || s.source === "UPLOAD_IMAGE_DRIVER") && s.clipAssetId && ready)
    return { kind: "video", id: s.clipAssetId };
  if (s.source === "UPLOAD_VIDEO" && s.sourceAssetId)
    return { kind: "video", id: s.sourceAssetId };
  if (
    (s.source === "UPLOAD_IMAGE_STILL" || s.source === "UPLOAD_IMAGE_DRIVER") &&
    s.sourceAssetId
  )
    return { kind: "image", id: s.sourceAssetId };
  return null;
}

/** Snap a proposed clip end (startS + next) to the nearest boundary/playhead. */
function snapDuration(next: number, startS: number, snapTimes: number[], pps: number): number {
  const end = startS + next;
  let best = next;
  let bestD = SNAP_PX / pps;
  for (const t of snapTimes) {
    if (t <= startS + 0.2) continue; // can't snap the end at/before the start
    const d = Math.abs(t - end);
    if (d < bestD) {
      bestD = d;
      best = t - startS;
    }
  }
  return Math.round(best * 10) / 10;
}

export function TimelineView({
  segments,
  overlays,
  readOnly,
  onReorder,
  onTrim,
  onSplit,
  onDelete,
  onOffset,
  onDropMedia,
  onDropAudio,
  onUnlinkAudio,
  selectedId = null,
  onSelect,
  playheadS,
  onSeek,
  projectId,
}: {
  segments: SegmentView[];
  overlays: OverlayView[];
  readOnly: boolean;
  onReorder: (orderedIds: string[]) => void;
  onTrim: (id: string, patch: { durationS?: number; trimStartS?: number }) => void;
  onSplit?: (id: string, atS: number) => void;
  onDelete?: (id: string) => void;
  onOffset?: (id: string, offsetS: number) => void;
  onDropMedia?: (payload: MediaDragPayload, track: number, offsetS: number) => void;
  onDropAudio?: (payload: AudioStudioDragPayload, offsetS: number) => void;
  onUnlinkAudio?: (videoSegmentId: string) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  playheadS?: number;
  onSeek?: (t: number) => void;
  projectId?: string;
}) {
  const [pps, setPps] = useState(48);
  // Per-clip detected tempo (BPM) + beat times, keyed by segment id. Measured on
  // demand via the ♩ button on each audio clip; beat markers draw in the A1 lane.
  const [tempos, setTempos] = useState<Record<string, { bpm: number | null; beats: number[] }>>({});
  const [tempoBusy, setTempoBusy] = useState<string | null>(null);
  const measureTempo = useCallback(
    async (seg: SegmentView) => {
      if (!projectId || !seg.sourceAssetId || tempoBusy) return;
      setTempoBusy(seg.id);
      try {
        const res = await api<{ tempo: { bpm: number | null; beatsS: number[] } | null }>(
          "/api/audio/analyze",
          {
            method: "POST",
            body: JSON.stringify({ projectId, assetId: seg.sourceAssetId, kinds: ["tempo"] }),
          },
        );
        setTempos((m) => ({
          ...m,
          [seg.id]: { bpm: res.tempo?.bpm ?? null, beats: res.tempo?.beatsS ?? [] },
        }));
      } catch {
        /* ignore — measurement is best-effort */
      } finally {
        setTempoBusy(null);
      }
    },
    [projectId, tempoBusy],
  );
  const [dragLane, setDragLane] = useState<"v1" | "v2" | "audio" | null>(null);
  // One height for every track row; drag any divider to resize them in unison.
  const [trackH, setTrackH] = useState(64);
  const resizeTracks = (h: number) =>
    setTrackH(Math.max(MIN_TRACK_H, Math.min(MAX_TRACK_H, Math.round(h))));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // V1 = the main contiguous sequence; V2 = positioned PiP overlay clips.
  // Audio-only clips (unlinked clip audio) live on the clip-audio track. Library
  // clips live in the Media Bucket only, never on the timeline.
  const onTimeline = segments.filter((s) => !s.library);
  const v1 = onTimeline.filter((s) => (s.track ?? 0) === 0 && !s.audioOnly);
  const v2 = onTimeline.filter((s) => (s.track ?? 0) === 1 && !s.audioOnly);
  const audioOnlySegs = onTimeline.filter((s) => s.audioOnly);
  const effDur = v1.map((s) => s.durationS);
  const starts: number[] = [];
  let acc = 0;
  for (const d of effDur) {
    starts.push(acc);
    acc += d;
  }
  const totalVideo = acc;
  const v2End = v2.reduce((m, s) => Math.max(m, (s.offsetS ?? 0) + s.durationS), 0);

  const overlayEnd = overlays.reduce(
    (m, o) => Math.max(m, o.offsetS + (o.durationS ?? Math.max(0, o.importEndS - o.importStartS))),
    0,
  );
  const audioClipEnd = audioOnlySegs.reduce((m, s) => Math.max(m, (s.offsetS ?? 0) + s.durationS), 0);
  const span = Math.max(totalVideo, overlayEnd, v2End, audioClipEnd, 1);
  const width = Math.max(span * pps, 1);

  // Adaptive ruler ticks (~80px apart).
  const step = NICE_STEPS.find((s) => s >= 80 / pps) ?? 600;
  const ticks: number[] = [];
  for (let t = 0; t <= span + 0.001; t += step) ticks.push(Math.round(t * 100) / 100);

  // Snap targets: the playhead + every clip boundary.
  const snapTimes = [...(playheadS != null ? [playheadS] : []), ...starts, totalVideo];
  // Hand snap targets to the clip blocks via a STABLE ref. snapTimes changes
  // every frame during playback (it includes the live playhead); passing the
  // array directly would re-render every memoized block 16×/s. The blocks read
  // snapTimesRef.current at drag time instead.
  const snapTimesRef = useRef<number[]>(snapTimes);
  useEffect(() => {
    snapTimesRef.current = snapTimes;
  });

  // The clip the playhead currently sits inside (for the blade), if any.
  const splitIndex =
    playheadS == null
      ? -1
      : starts.findIndex((st, k) => playheadS >= st + 0.05 && playheadS <= st + effDur[k] - 0.05);
  const canSplit = onSplit != null && splitIndex >= 0;

  function splitAtPlayhead() {
    if (!onSplit || splitIndex < 0 || playheadS == null) return;
    onSplit(v1[splitIndex].id, Math.round((playheadS - starts[splitIndex]) * 10) / 10);
  }

  function deleteSelected() {
    if (onDelete && selectedId) {
      onDelete(selectedId);
      onSelect?.(null);
    }
  }

  // Unlink works on the selected clip — only meaningful for a video clip that
  // carries its own audio (muted === false, not already an audio clip).
  const selectedSeg = selectedId ? segments.find((s) => s.id === selectedId) : null;
  const canUnlink = !!onUnlinkAudio && !!selectedSeg && selectedSeg.muted === false && !selectedSeg.audioOnly;
  function unlinkSelected() {
    if (canUnlink && selectedId) onUnlinkAudio?.(selectedId);
  }

  // Native drop target for Media Bucket drags. V1 drop appends; V2 drop places
  // a PiP overlay at the drop point.
  function laneDropProps(track: "v1" | "v2" | "audio") {
    if (readOnly || (!onDropMedia && !onDropAudio)) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!hasMediaDrag(e.dataTransfer) && !hasAudioDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (dragLane !== track) setDragLane(track);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragLane((l) => (l === track ? null : l));
        }
      },
      onDrop: (e: React.DragEvent) => {
        // Audio Studio workspace file → bridge to an Asset, then place audio-only.
        const audio = readAudioDrag(e.dataTransfer);
        if (audio && onDropAudio) {
          e.preventDefault();
          setDragLane(null);
          const rect = e.currentTarget.getBoundingClientRect();
          onDropAudio(audio, Math.max(0, (e.clientX - rect.left) / pps));
          return;
        }
        const payload = readMediaDrag(e.dataTransfer);
        setDragLane(null);
        if (!payload) return;
        if (track === "audio") {
          if (!payload.isAudio) return; // audio tracks only take audio
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          onDropMedia(payload, 0, Math.max(0, (e.clientX - rect.left) / pps));
        } else if (track === "v2") {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          onDropMedia(payload, 1, Math.max(0, (e.clientX - rect.left) / pps));
        } else {
          e.preventDefault();
          onDropMedia(payload, 0, 0);
        }
      },
    };
  }

  // Delete / Backspace ripple-deletes the selected clip (unless typing).
  useEffect(() => {
    if (!onDelete || readOnly || !selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDelete(selectedId);
        onSelect?.(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDelete, readOnly, selectedId, onSelect]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const v1ids = v1.map((s) => s.id);
    const from = v1ids.indexOf(String(active.id));
    const to = v1ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    // Reorder within V1; keep the V2 overlays in their existing order.
    onReorder([...arrayMove(v1ids, from, to), ...v2.map((s) => s.id)]);
  }

  // Clip audio present on the timeline (linked clips' audio or unlinked clips).
  const hasClipAudio =
    v1.some((s) => s.muted === false) ||
    v2.some((s) => s.muted === false) ||
    audioOnlySegs.length > 0;

  const ROW = { ruler: "h-7" };
  // Icon-only toolbar buttons (Split / Unlink / Delete / Zoom).
  const toolBtn =
    "flex h-6 w-6 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs hover:border-[#39414f] disabled:opacity-40 disabled:hover:border-[var(--color-border)]";

  return (
    <div className="flex h-full flex-col bg-[#0b0e14] p-2">
      {/* Toolbar — the empty stretch doubles as the window drag handle (no title bar) */}
      <div className="mb-1.5 flex shrink-0 items-center gap-1.5">
        <div className="window-drag-handle h-6 min-w-0 flex-1 cursor-move" title="Drag to move" />
        <span className="font-mono tnum text-[10px] text-[var(--color-muted)]">
          {fmtClock(totalVideo)}
          {audioClipEnd ? ` · ${fmtClock(audioClipEnd)}` : ""}
        </span>
        {!readOnly && onSplit ? (
          <button type="button" className={toolBtn} disabled={!canSplit} onClick={splitAtPlayhead} title="Split clip at the playhead">
            ✂
          </button>
        ) : null}
        {!readOnly && onUnlinkAudio ? (
          <button type="button" className={toolBtn} disabled={!canUnlink} onClick={unlinkSelected} title="Unlink the selected clip's audio onto an audio track">
            🔗
          </button>
        ) : null}
        {!readOnly && onDelete ? (
          <button type="button" className={toolBtn} disabled={!selectedId} onClick={deleteSelected} title="Ripple-delete the selected clip (Del)">
            🗑
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Zoom out"
          className={toolBtn}
          onClick={() => setPps((p) => Math.max(MIN_PPS, Math.round(p / 1.4)))}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          className={toolBtn}
          onClick={() => setPps((p) => Math.min(MAX_PPS, Math.round(p * 1.4)))}
        >
          +
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {/* Track header gutter */}
        <div className="w-14 shrink-0 select-none text-[10px] font-semibold text-[var(--color-muted)]">
          <div className={ROW.ruler} />
          <GutterLabel h={trackH}>V1</GutterLabel>
          <GutterLabel h={trackH}>V2</GutterLabel>
          <GutterLabel h={trackH}>A1</GutterLabel>
          <GutterLabel h={trackH}>A2</GutterLabel>
        </div>

        {/* Scrolling timeline */}
        <div className="flex-1 overflow-x-auto">
          {/* min-w-full so the lanes (and their media drop targets) always fill the
              panel even when the timeline is near-empty — otherwise an empty project
              collapses `width` to ~48px and there's nothing to drop a clip onto. */}
          <div style={{ width }} className="relative min-w-full">
            {/* Playhead — synced to the preview clock; click the ruler to seek */}
            {playheadS != null ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-[var(--color-accent)]"
                style={{ left: Math.max(0, playheadS) * pps }}
              >
                <div className="absolute -left-[3px] top-0 h-1.5 w-1.5 rotate-45 bg-[var(--color-accent)]" />
              </div>
            ) : null}
            {/* Ruler */}
            <div
              className={`relative ${ROW.ruler} border-b border-[var(--color-border)] ${onSeek ? "cursor-pointer" : ""}`}
              onClick={(e) => {
                if (!onSeek) return;
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek(Math.max(0, (e.clientX - rect.left) / pps));
              }}
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full border-l border-[var(--color-border)] pl-1"
                  style={{ left: t * pps }}
                >
                  <span className="font-mono text-[9px] text-[var(--color-muted)]">
                    {fmtClock(t)}
                  </span>
                </div>
              ))}
            </div>

            {/* V1 video track — sortable, tiled blocks (also a media drop target) */}
            <div
              {...laneDropProps("v1")}
              style={{ height: trackH }}
              className={`relative border-b border-[var(--color-border)] bg-[#0e121a] ${
                dragLane === "v1" ? "ring-2 ring-inset ring-[var(--color-accent)]" : ""
              }`}
            >
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={v1.map((s) => s.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex h-full items-stretch p-1">
                    {v1.map((s, i) => (
                      <ClipBlock
                        key={s.id}
                        segment={s}
                        index={i}
                        startS={starts[i]}
                        widthPx={Math.max(effDur[i] * pps, 6)}
                        durLabel={`${effDur[i].toFixed(1)}s`}
                        pps={pps}
                        snapTimesRef={snapTimesRef}
                        readOnly={readOnly}
                        selected={selectedId === s.id}
                        onSelect={onSelect}
                        onTrim={onTrim}
                      />
                    ))}
                    {v1.length === 0 ? (
                      <span className="m-auto text-xs text-[var(--color-muted)]">
                        No clips yet
                      </span>
                    ) : null}
                  </div>
                </SortableContext>
              </DndContext>
              <ResizeHandle value={trackH} onResize={resizeTracks} />
            </div>

            {/* V2 video track — positioned PiP overlay clips, drag to set the offset
                (also a media drop target: drop places a PiP at the drop point) */}
            <div
              {...laneDropProps("v2")}
              style={{ height: trackH }}
              className={`relative border-b border-[var(--color-border)] bg-[#101626] ${
                dragLane === "v2" ? "ring-2 ring-inset ring-[var(--color-accent)]" : ""
              }`}
            >
              {v2.length === 0 ? (
                <Empty>drag a clip here, or use Effect Controls → “Move to overlay”</Empty>
              ) : (
                v2.map((s) => (
                  <OverlayBlock
                    key={s.id}
                    segment={s}
                    pps={pps}
                    span={span}
                    readOnly={readOnly}
                    selected={selectedId === s.id}
                    onSelect={onSelect}
                    onOffset={onOffset}
                    onTrim={onTrim}
                    snapTimesRef={snapTimesRef}
                  />
                ))
              )}
              <ResizeHandle value={trackH} onResize={resizeTracks} />
            </div>

            {/* A1 — clip audio: linked mirrors (move with their clip) + unlinked clips.
                Also a drop target for audio media from the Media Bucket. */}
            <div
              {...laneDropProps("audio")}
              style={{ height: trackH }}
              className={`relative border-b border-[var(--color-border)] bg-[#0c1016] ${
                dragLane === "audio" ? "ring-2 ring-inset ring-[var(--color-accent)]" : ""
              }`}
            >
              {v1.map((s, i) =>
                s.muted === false ? (
                  <AudioBlock
                    key={`lk-${s.id}`}
                    left={starts[i] * pps}
                    width={Math.max(effDur[i] * pps, 6)}
                    hue="#2ec5c5"
                    label="🔗 audio"
                    title="Linked audio — right-click to Unlink"
                  />
                ) : null,
              )}
              {v2.map((s) =>
                s.muted === false ? (
                  <AudioBlock
                    key={`lk2-${s.id}`}
                    left={(s.offsetS ?? 0) * pps}
                    width={Math.max(s.durationS * pps, 6)}
                    hue="#2ec5c5"
                    label="🔗 audio"
                    title="Linked audio — right-click to Unlink"
                  />
                ) : null,
              )}
              {audioOnlySegs.map((s) => (
                <AudioClipBlock
                  key={s.id}
                  segment={s}
                  pps={pps}
                  readOnly={readOnly}
                  selected={selectedId === s.id}
                  onSelect={onSelect}
                  onOffset={onOffset}
                  onTrim={onTrim}
                  bpm={tempos[s.id]?.bpm ?? null}
                  busy={tempoBusy === s.id}
                  onMeasure={projectId && s.sourceAssetId ? () => void measureTempo(s) : undefined}
                />
              ))}
              {/* Beat markers (▾) for any measured audio clip, mapped through its
                  offset + left-trim into timeline time. */}
              {audioOnlySegs.flatMap((s) => {
                const beats = tempos[s.id]?.beats;
                if (!beats?.length) return [];
                const trim = s.trimStartS ?? 0;
                const off = s.offsetS ?? 0;
                return beats
                  .map((b, i) => {
                    const local = b - trim;
                    if (local < 0 || local > s.durationS) return null;
                    return (
                      <span
                        key={`beat-${s.id}-${i}`}
                        className="pointer-events-none absolute top-0 z-30 -translate-x-1/2 text-[8px] leading-none text-[var(--color-accent)]"
                        style={{ left: (off + local) * pps }}
                      >
                        ▾
                      </span>
                    );
                  })
                  .filter(Boolean);
              })}
              {!hasClipAudio ? <Empty>clip audio appears here</Empty> : null}
              <ResizeHandle value={trackH} onResize={resizeTracks} />
            </div>

            {/* A2 — audio overlays (imported audio) */}
            <div style={{ height: trackH }} className="relative bg-[#0c1016]">
              {overlays.map((o) => {
                const len = o.durationS ?? Math.max(0, o.importEndS - o.importStartS);
                return (
                  <AudioBlock
                    key={o.id}
                    left={o.offsetS * pps}
                    width={Math.max(len * pps, 6)}
                    hue="#e05a4a"
                    label={o.label?.trim() ? o.label : "YT audio"}
                    faded={!o.included}
                  />
                );
              })}
              {overlays.length === 0 ? <Empty>imported audio appears here</Empty> : null}
              <ResizeHandle value={trackH} onResize={resizeTracks} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GutterLabel({ children, h }: { children: React.ReactNode; h: number }) {
  return (
    <div
      style={{ height: h }}
      className="flex items-center justify-end border-b border-[var(--color-border)] pr-2"
    >
      {children}
    </div>
  );
}

/** A thin grab-strip on a track's bottom edge. Dragging it sets the shared
 *  track height (so every track resizes in unison), Premiere-style. */
function ResizeHandle({ value, onResize }: { value: number; onResize: (h: number) => void }) {
  return (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const start = value;
        const startY = e.clientY;
        const move = (ev: PointerEvent) => onResize(start + (ev.clientY - startY));
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      title="Drag to resize track heights"
      className="absolute inset-x-0 bottom-0 z-30 h-1.5 cursor-row-resize hover:bg-[var(--color-accent)]/50"
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] italic text-[var(--color-muted)]/70">
      {children}
    </span>
  );
}

const ClipBlock = memo(function ClipBlock({
  segment,
  index,
  startS,
  widthPx,
  durLabel,
  pps,
  snapTimesRef,
  readOnly,
  selected,
  onSelect,
  onTrim,
}: {
  segment: SegmentView;
  index: number;
  startS: number;
  widthPx: number;
  durLabel: string;
  pps: number;
  snapTimesRef: React.RefObject<number[]>;
  readOnly: boolean;
  selected: boolean;
  onSelect?: (id: string | null) => void;
  onTrim: (id: string, patch: { durationS?: number; trimStartS?: number }) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: segment.id, disabled: readOnly });
  const hue = segmentHue(segment);
  const notReady = segment.status !== "READY" && segment.status !== "PENDING";
  const failed = segment.status === "FAILED";
  const thumb = thumbOf(segment);

  // Only mount the thumbnail <video> once the block scrolls near the viewport.
  // A 240-clip timeline would otherwise create 240 metadata loads up front,
  // starving the actual preview-clip loads (the cold-start stall). Once shown,
  // it stays (progressive as you scroll).
  const [thumbReady, setThumbReady] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      rootRef.current = node;
    },
    [setNodeRef],
  );
  useEffect(() => {
    if (thumbReady) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setThumbReady(true);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [thumbReady]);

  // Right-edge trim (out-point): drag to shorten OR extend back, in 0.1s steps.
  // The max is the remaining source after the in-point (trimStartS); stills extend
  // freely; a video with no known source length (legacy) is shrink-only.
  function startTrimOut(e: React.PointerEvent) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startDur = segment.durationS;
    const trimStartS = segment.trimStartS ?? 0;
    const speed = segment.speed || 1;
    const isStill = segment.source === "UPLOAD_IMAGE_STILL";
    const maxDur =
      segment.sourceDurationS != null
        ? Math.max(0, (segment.sourceDurationS - trimStartS) / speed)
        : isStill
          ? 600
          : startDur;
    const move = (ev: PointerEvent) => {
      const raw = startDur + (ev.clientX - startX) / pps;
      const snapped = snapDuration(raw, startS, snapTimesRef.current, pps);
      const next = Math.round(Math.min(maxDur, Math.max(0.5, snapped)) * 10) / 10;
      if (next !== segment.durationS) onTrim(segment.id, { durationS: next });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Left-edge trim (in-point): drag right to skip the start of the source; drag
  // back to restore. The out-point in source stays fixed — Premiere style. For
  // stills there's no source, so the left handle just shortens (no in-point).
  function startTrimIn(e: React.PointerEvent) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startDur = segment.durationS;
    const startTrim = segment.trimStartS ?? 0;
    const speed = segment.speed || 1;
    const isStill = segment.source === "UPLOAD_IMAGE_STILL";
    // Out-point in source is fixed during a left-edge drag.
    const outPointSource = startTrim + startDur * speed;
    // Cap: re-extending all the way pulls trimStartS to 0.
    const maxDur = isStill ? 600 : outPointSource / speed;
    const move = (ev: PointerEvent) => {
      const raw = startDur - (ev.clientX - startX) / pps; // drag right shrinks
      const snapped = snapDuration(raw, startS, snapTimesRef.current, pps);
      const next = Math.round(Math.min(maxDur, Math.max(0.5, snapped)) * 10) / 10;
      if (isStill) {
        if (next !== segment.durationS) onTrim(segment.id, { durationS: next });
        return;
      }
      const newTrim = Math.round(Math.max(0, outPointSource - next * speed) * 10) / 10;
      if (next !== segment.durationS || newTrim !== (segment.trimStartS ?? 0)) {
        onTrim(segment.id, { durationS: next, trimStartS: newTrim });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      ref={setRefs}
      {...attributes}
      {...(readOnly ? {} : listeners)}
      onClick={() => onSelect?.(segment.id)}
      style={{
        width: widthPx,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      title={`${index + 1}. ${shortLabel(segment)} · ${durLabel}`}
      className={`relative mr-0.5 flex shrink-0 touch-none flex-col justify-between overflow-hidden rounded-md p-1.5 text-white shadow-soft transition duration-200 ease-spring ${
        readOnly ? "" : "cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-lift"
      } ${isDragging ? "opacity-90 ring-2 ring-white/70" : ""} ${
        selected ? "ring-2 ring-[var(--color-accent)]" : ""
      } ${failed ? "ring-1 ring-[var(--color-danger)]" : ""}`}
    >
      {/* Base type gradient — the fallback when there's no preview yet. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: blockBg(hue), opacity: notReady ? 0.55 : 1 }}
      />
      {/* Preview frame: still image directly, or a video's first frame. */}
      {thumb && thumbReady ? (
        thumb.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withBase(`/api/assets/${thumb.id}`)}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <video
            src={`${withBase(`/api/assets/${thumb.id}`)}#t=${((segment.trimStartS ?? 0) + 0.5).toFixed(2)}`}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )
      ) : null}
      {/* Legibility scrim + type-color left accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/35"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: hue }}
      />
      <div className="relative truncate pl-1 text-[11px] font-semibold leading-tight drop-shadow">
        <span className="opacity-80">{index + 1}</span> {shortLabel(segment)}
      </div>
      <div className="relative flex items-center justify-between gap-1 pl-1">
        <span className="font-mono tnum text-[10px] opacity-90 drop-shadow">{durLabel}</span>
        {notReady ? (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${failed ? "" : "animate-pulse"}`}
            style={{ background: failed ? "var(--color-danger)" : "#ffffff" }}
          />
        ) : null}
      </div>
      {/* Left-edge handle (in-point) — drag right to skip the start of the source. */}
      {!readOnly ? (
        <div
          onPointerDown={startTrimIn}
          title="Drag to trim from the start"
          className="group absolute inset-y-0 left-0 z-20 flex w-2.5 cursor-ew-resize touch-none items-center justify-center"
        >
          <div className="h-1/2 w-1 rounded-full bg-white/40 transition-colors group-hover:bg-white/90" />
        </div>
      ) : null}
      {/* Right-edge handle (out-point) — drag left to end the clip earlier. */}
      {!readOnly ? (
        <div
          onPointerDown={startTrimOut}
          title="Drag to trim from the end"
          className="group absolute inset-y-0 right-0 z-20 flex w-2.5 cursor-ew-resize touch-none items-center justify-center"
        >
          <div className="h-1/2 w-1 rounded-full bg-white/40 transition-colors group-hover:bg-white/90" />
        </div>
      ) : null}
    </div>
  );
});

/** A V2 overlay (PiP) clip block: positioned at its offset, drag to reposition. */
const OverlayBlock = memo(function OverlayBlock({
  segment,
  pps,
  span,
  readOnly,
  selected,
  onSelect,
  onOffset,
  onTrim,
  snapTimesRef,
}: {
  segment: SegmentView;
  pps: number;
  span: number;
  readOnly: boolean;
  selected: boolean;
  onSelect?: (id: string | null) => void;
  onOffset?: (id: string, offsetS: number) => void;
  onTrim?: (id: string, patch: { durationS?: number; trimStartS?: number }) => void;
  snapTimesRef: React.RefObject<number[]>;
}) {
  const off = segment.offsetS ?? 0;
  const hue = segmentHue(segment);
  const thumb = thumbOf(segment);
  const maxOff = Math.max(0, span - segment.durationS);

  function startDrag(e: React.PointerEvent) {
    if (readOnly || !onOffset) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startOff = off;
    const move = (ev: PointerEvent) => {
      let next = startOff + (ev.clientX - startX) / pps;
      // Snap the start edge to the playhead / clip boundaries.
      const thresh = SNAP_PX / pps;
      for (const t of snapTimesRef.current) {
        if (Math.abs(t - next) < thresh) {
          next = t;
          break;
        }
      }
      next = Math.round(Math.min(maxOff, Math.max(0, next)) * 10) / 10;
      if (next !== (segment.offsetS ?? 0)) onOffset(segment.id, next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Edge trim for overlays: right handle changes duration; left handle moves the
  // start (offsetS) + resizes so the right edge stays fixed (video also skips
  // into the source via trimStartS; stills just move + resize).
  const drag = (move: (ev: PointerEvent) => void) => {
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  function trimRight(e: React.PointerEvent) {
    if (readOnly || !onTrim) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startDur = segment.durationS;
    const trim = segment.trimStartS ?? 0;
    const speed = segment.speed || 1;
    const isStill = segment.source === "UPLOAD_IMAGE_STILL";
    const maxDur =
      segment.sourceDurationS != null
        ? Math.max(0.1, (segment.sourceDurationS - trim) / speed)
        : isStill
          ? 600
          : startDur;
    drag((ev) => {
      const next = Math.round(Math.min(maxDur, Math.max(0.5, startDur + (ev.clientX - startX) / pps)) * 10) / 10;
      if (next !== segment.durationS) onTrim(segment.id, { durationS: next });
    });
  }
  function trimLeft(e: React.PointerEvent) {
    if (readOnly || !onOffset || !onTrim) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startOff = off;
    const startDur = segment.durationS;
    const startTrim = segment.trimStartS ?? 0;
    const speed = segment.speed || 1;
    const isStill = segment.source === "UPLOAD_IMAGE_STILL";
    drag((ev) => {
      let dx = (ev.clientX - startX) / pps;
      dx = Math.min(dx, startDur - 0.5); // keep >= 0.5s
      dx = Math.max(dx, -startOff); // start can't go before 0
      if (!isStill) dx = Math.max(dx, -startTrim / speed); // can't pull trimStartS below 0
      const newOff = Math.round((startOff + dx) * 10) / 10;
      const newDur = Math.round((startDur - dx) * 10) / 10;
      onOffset(segment.id, newOff);
      if (isStill) onTrim(segment.id, { durationS: newDur });
      else onTrim(segment.id, { durationS: newDur, trimStartS: Math.round(Math.max(0, startTrim + dx * speed) * 10) / 10 });
    });
  }

  return (
    <div
      onPointerDown={startDrag}
      onClick={() => onSelect?.(segment.id)}
      title={`Overlay · ${shortLabel(segment)} · ${segment.durationS.toFixed(1)}s @ ${off.toFixed(1)}s`}
      style={{ left: off * pps, width: Math.max(segment.durationS * pps, 8), top: "10%", height: "80%" }}
      className={`absolute flex touch-none flex-col justify-between overflow-hidden rounded-md p-1 text-white shadow-soft ${
        readOnly ? "" : "cursor-grab active:cursor-grabbing"
      } ${selected ? "ring-2 ring-[var(--color-accent)]" : ""}`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: blockBg(hue) }} />
      {thumb && thumb.kind === "video" ? (
        <video
          src={`${withBase(`/api/assets/${thumb.id}`)}#t=0.5`}
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={withBase(`/api/assets/${thumb.id}`)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
      <div className="relative truncate text-[10px] font-semibold leading-tight drop-shadow">
        ⤴ {shortLabel(segment)}
      </div>
      <div className="relative font-mono tnum text-[9px] opacity-90 drop-shadow">{segment.durationS.toFixed(1)}s</div>
      {!readOnly && onTrim ? (
        <>
          <div
            onPointerDown={trimLeft}
            title="Drag to trim from the start"
            className="group absolute inset-y-0 left-0 z-20 flex w-2 cursor-ew-resize touch-none items-center justify-center"
          >
            <div className="h-1/2 w-0.5 rounded-full bg-white/40 transition-colors group-hover:bg-white/90" />
          </div>
          <div
            onPointerDown={trimRight}
            title="Drag to trim from the end"
            className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-ew-resize touch-none items-center justify-center"
          >
            <div className="h-1/2 w-0.5 rounded-full bg-white/40 transition-colors group-hover:bg-white/90" />
          </div>
        </>
      ) : null}
    </div>
  );
});

/** A draggable, selectable, trimmable audio clip on the A-tracks. */
const AudioClipBlock = memo(function AudioClipBlock({
  segment,
  pps,
  readOnly,
  selected,
  onSelect,
  onOffset,
  onTrim,
  bpm,
  busy,
  onMeasure,
}: {
  segment: SegmentView;
  pps: number;
  readOnly: boolean;
  selected: boolean;
  onSelect?: (id: string | null) => void;
  onOffset?: (id: string, offsetS: number) => void;
  onTrim: (id: string, patch: { durationS?: number; trimStartS?: number }) => void;
  bpm?: number | null;
  busy?: boolean;
  onMeasure?: () => void;
}) {
  const s = segment;
  const off = s.offsetS ?? 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const drag = (move: (ev: PointerEvent) => void) => {
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Body: move the whole clip (offsetS). A click without a drag just selects.
  function startMove(e: React.PointerEvent) {
    if (readOnly || !onOffset) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startOff = off;
    drag((ev) => {
      const next = Math.max(0, round1(startOff + (ev.clientX - startX) / pps));
      if (next !== (s.offsetS ?? 0)) onOffset(s.id, next);
    });
  }

  // Right edge: change duration (capped to the source length when known).
  function trimRight(e: React.PointerEvent) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startDur = s.durationS;
    const trim = s.trimStartS ?? 0;
    const maxDur = s.sourceDurationS != null ? Math.max(0.1, s.sourceDurationS - trim) : 12 * 60 * 60;
    drag((ev) => {
      const next = round1(Math.min(maxDur, Math.max(0.1, startDur + (ev.clientX - startX) / pps)));
      if (next !== s.durationS) onTrim(s.id, { durationS: next });
    });
  }

  // Left edge: trim from the start — the timeline-right edge stays fixed, so the
  // offset + in-point move together with the length.
  function trimLeft(e: React.PointerEvent) {
    if (readOnly || !onOffset) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startOff = off;
    const startDur = s.durationS;
    const startTrim = s.trimStartS ?? 0;
    drag((ev) => {
      let dx = (ev.clientX - startX) / pps;
      dx = Math.min(dx, startDur - 0.1);
      dx = Math.max(dx, -startTrim, -startOff);
      const newOff = round1(startOff + dx);
      const newDur = round1(startDur - dx);
      const newTrim = round1(startTrim + dx);
      onOffset(s.id, newOff);
      onTrim(s.id, { durationS: newDur, trimStartS: Math.max(0, newTrim) });
    });
  }

  const handle =
    "group absolute inset-y-0 z-20 flex w-2 cursor-ew-resize touch-none items-center justify-center";
  return (
    <div
      onPointerDown={startMove}
      onClick={() => onSelect?.(s.id)}
      title={`Audio · ${s.durationS.toFixed(1)}s @ ${off.toFixed(1)}s`}
      style={{ left: off * pps, width: Math.max(s.durationS * pps, 12) }}
      className={`group absolute top-1/2 flex h-[72%] -translate-y-1/2 touch-none items-center overflow-hidden rounded-md px-2 text-[10px] font-semibold text-white shadow-soft ${
        readOnly ? "" : "cursor-grab active:cursor-grabbing"
      } ${selected ? "ring-2 ring-[var(--color-accent)]" : ""}`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: blockBg("#38b27a") }} />
      {s.sourceAssetId ? (
        <Waveform url={withBase(`/api/assets/${s.sourceAssetId}`)} color="#38b27a" className="absolute inset-0" />
      ) : null}
      <span className="relative truncate drop-shadow">audio · {s.durationS.toFixed(1)}s</span>
      {onMeasure ? (
        <button
          type="button"
          disabled={busy}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMeasure();
          }}
          title={bpm ? `${Math.round(bpm)} BPM — click to re-measure` : "Measure tempo (BPM)"}
          className="absolute left-1 top-1 z-30 rounded bg-black/45 px-1 text-[8px] font-semibold leading-none text-white/80 backdrop-blur-sm hover:text-white disabled:opacity-50"
        >
          {busy ? "…" : bpm ? `♩${Math.round(bpm)}` : "♩"}
        </button>
      ) : null}
      {!readOnly ? (
        <>
          <div onPointerDown={trimLeft} title="Drag to trim from the start" className={`${handle} left-0`}>
            <div className="h-1/2 w-0.5 rounded-full bg-white/40 transition-colors group-hover:bg-white/90" />
          </div>
          <div onPointerDown={trimRight} title="Drag to trim from the end" className={`${handle} right-0`}>
            <div className="h-1/2 w-0.5 rounded-full bg-white/40 transition-colors group-hover:bg-white/90" />
          </div>
        </>
      ) : null}
    </div>
  );
});

function AudioBlock({
  left,
  width,
  hue,
  label,
  striped = false,
  faded = false,
  title,
  draggable = false,
  onPointerDown,
}: {
  left: number;
  width: number;
  hue: string;
  label: string;
  striped?: boolean;
  faded?: boolean;
  title?: string;
  draggable?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[10px] font-semibold text-white shadow-soft ${
        faded ? "opacity-40" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        left,
        width,
        height: "72%",
        background: striped
          ? `repeating-linear-gradient(135deg, ${hue}, ${hue} 8px, color-mix(in srgb, ${hue}, #000 22%) 8px, color-mix(in srgb, ${hue}, #000 22%) 16px)`
          : blockBg(hue),
      }}
      title={title ?? label}
    >
      <span className="truncate drop-shadow">{label}</span>
    </div>
  );
}
