"use client";

import { useRef, useState } from "react";
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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CAPS } from "@/config/models";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { Button } from "@/components/ui";
import { ClipGallery } from "./ClipGallery";
import { type SegmentPatch, type SegmentView } from "./SegmentCard";
import { SortableSegment } from "./SortableSegment";
import { YouTubeImport } from "./YouTubeImport";

type UploadKind = "UPLOAD_VIDEO" | "UPLOAD_IMAGE_STILL" | "UPLOAD_IMAGE_DRIVER";

export function VisualSection({
  projectId,
  segments,
  concept,
  visualGenStatus,
  voiceoverDurationS,
  isAdmin,
  projectVideoModel,
  readOnly,
  onSegmentChange,
  onReorder,
  save,
  refetch,
}: {
  projectId: string;
  segments: SegmentView[];
  concept: string | null;
  visualGenStatus: string | null;
  voiceoverDurationS: number | null;
  isAdmin: boolean;
  projectVideoModel: string;
  readOnly: boolean;
  onSegmentChange: (id: string, patch: SegmentPatch) => void;
  onReorder: (orderedIds: string[]) => void;
  save: () => Promise<boolean>;
  refetch: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<UploadKind | null>(null);
  const generating = visualGenStatus === "RUNNING";
  const atMax = segments.length >= CAPS.maxSegments;

  const sensors = useSensors(
    // A small drag threshold so clicks on the grip don't fight ordinary clicks.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Persist any draft edits, then open the reuse gallery. The gallery inserts
  // server-side; we refetch once on close (which remounts this editor).
  async function openGallery() {
    setBusy(true);
    setError(null);
    try {
      if (await save()) setShowGallery(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openYouTube() {
    setBusy(true);
    setError(null);
    try {
      if (await save()) setShowYouTube(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      if (!(await save())) return;
      await fn();
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addSegment(body: Record<string, unknown>) {
    return run(() =>
      api(`/api/projects/${projectId}/segments`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  function uploadThenAdd(kind: UploadKind) {
    pendingKind.current = kind;
    fileRef.current!.accept =
      kind === "UPLOAD_VIDEO" ? "video/mp4,video/quicktime,video/webm" : "image/png,image/jpeg,image/webp";
    fileRef.current?.click();
  }

  async function onFile(file: File) {
    const kind = pendingKind.current;
    pendingKind.current = null;
    if (!kind) return;
    await run(async () => {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      const res = await fetch(withBase("/api/uploads"), { method: "POST", body: fd });
      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok || json.error || !json.data) throw new Error(json.error ?? "upload failed");
      const assetId = json.data.id;
      const body: Record<string, unknown> = { source: kind, sourceAssetId: assetId };
      if (kind === "UPLOAD_IMAGE_STILL") body.durationS = 5;
      if (kind === "UPLOAD_IMAGE_DRIVER") body.refRole = "FIRST_FRAME";
      await api(`/api/projects/${projectId}/segments`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    });
  }

  // Reorder optimistically (instant local feedback), then persist + reconcile.
  function persistOrder(order: string[]) {
    onReorder(order);
    void run(() =>
      api(`/api/projects/${projectId}/segments/reorder`, {
        method: "POST",
        body: JSON.stringify({ orderedIds: order }),
      }),
    );
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= segments.length) return;
    const order = segments.map((s) => s.id);
    [order[index], order[j]] = [order[j], order[index]];
    persistOrder(order);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = segments.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    persistOrder(arrayMove(ids, from, to));
  }

  const totalDur = segments.reduce((a, s) => a + s.durationS, 0);
  // Calibration: how the cut video length compares to the spoken voiceover.
  const voDur = voiceoverDurationS;
  const delta = voDur != null ? totalDur - voDur : null;
  const calib =
    delta == null
      ? null
      : Math.abs(delta) < 0.5
        ? { text: "matches voiceover", color: "var(--color-success)" }
        : delta < 0
          ? { text: `${Math.abs(delta).toFixed(1)}s shorter than voiceover`, color: "var(--color-warning)" }
          : { text: `${delta.toFixed(1)}s longer than voiceover`, color: "var(--color-warning)" };

  return (
    <div className="space-y-4 short:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Visual track</h2>
          <p className="text-xs text-[var(--color-muted)]">
            {segments.length} segment{segments.length === 1 ? "" : "s"} · video ~{totalDur.toFixed(1)}s
            {voDur != null ? ` · voiceover ${voDur.toFixed(1)}s` : ""}
          </p>
          {calib ? (
            <p className="text-xs font-medium" style={{ color: calib.color }}>
              {calib.text}
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={busy || generating}
            onClick={() => void run(() => api(`/api/projects/${projectId}/generate-storyboard`, { method: "POST", body: "{}" }))}
          >
            {generating ? "Generating…" : "✨ Generate storyboard (AI)"}
          </Button>
        ) : null}
      </div>

      {concept ? (
        <p className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-fg)]">Concept: </span>
          {concept}
        </p>
      ) : null}

      {segments.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          No segments yet. Generate a storyboard with AI, or add your own clips and photos below.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {segments.map((s, i) => (
                <SortableSegment
                  key={s.id}
                  position={i + 1}
                  projectId={projectId}
                  segment={s}
                  editable={!readOnly}
                  isAdmin={isAdmin}
                  projectVideoModel={projectVideoModel}
                  onChange={(p) => onSegmentChange(s.id, p)}
                  onRemove={() => void run(() => api(`/api/projects/${projectId}/segments/${s.id}`, { method: "DELETE" }))}
                  onMoveUp={() => move(i, -1)}
                  onMoveDown={() => move(i, 1)}
                  onRetry={async () => {
                    await api(`/api/projects/${projectId}/segments/${s.id}/retry`, { method: "POST", body: "{}" });
                    await refetch();
                  }}
                  onRecut={(startS, endS) =>
                    run(() =>
                      api(`/api/projects/${projectId}/segments/${s.id}/recut`, {
                        method: "POST",
                        body: JSON.stringify({ startS, endS }),
                      }),
                    )
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!readOnly ? (
        <div className="flex flex-wrap items-stretch gap-1.5">
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <AddTile
            icon={<span aria-hidden>🤖</span>}
            label="AI"
            title="AI shot — generate video from a prompt (attach a reference photo in the shot to drive it)"
            disabled={busy || atMax}
            onClick={() => void addSegment({ source: "AI_GENERATED", durationS: 5 })}
          />
          <AddTile
            icon={<span aria-hidden>📽️</span>}
            label="Video"
            title="Upload a video clip"
            disabled={busy || atMax}
            onClick={() => uploadThenAdd("UPLOAD_VIDEO")}
          />
          <AddTile
            icon={<span aria-hidden>📷</span>}
            label="Photo"
            title="Add a photo as a timed still"
            disabled={busy || atMax}
            onClick={() => uploadThenAdd("UPLOAD_IMAGE_STILL")}
          />
          <AddTile
            icon={<span aria-hidden>↺</span>}
            label="Reuse"
            title="Reuse a previously generated clip"
            disabled={busy || atMax}
            onClick={() => void openGallery()}
          />
          <AddTile
            icon={<YouTubeMark />}
            label="YouTube"
            title="Import a clip from YouTube"
            disabled={busy || atMax}
            onClick={() => void openYouTube()}
          />
        </div>
      ) : null}

      {showYouTube ? (
        <YouTubeImport
          projectId={projectId}
          onClose={async (imported) => {
            setShowYouTube(false);
            if (imported) await refetch();
          }}
        />
      ) : null}

      {showGallery ? (
        <ClipGallery
          projectId={projectId}
          maxInserts={Math.max(0, CAPS.maxSegments - segments.length)}
          onClose={async (n) => {
            setShowGallery(false);
            if (n > 0) await refetch();
          }}
        />
      ) : null}
      {atMax && !readOnly ? (
        <p className="text-xs text-[var(--color-muted)]">Maximum {CAPS.maxSegments} segments.</p>
      ) : null}
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

/** Compact icon tile for the "add segment" row (icon over a tiny label). */
function AddTile({
  icon,
  label,
  title,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      // Square icon-over-label tiles; on short viewports they collapse into
      // icon+label pills (~half the height) so the row fits a narrow panel.
      className="flex w-14 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-md border border-[var(--color-border)] px-1 py-1.5 text-[10px] text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-40 short:h-7 short:w-auto short:flex-row short:gap-1.5 short:px-2 short:py-0"
    >
      <span className="flex h-[18px] items-center justify-center text-base leading-none short:h-auto short:text-sm">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/** The YouTube wordmark glyph (red rounded rect + white play triangle). */
function YouTubeMark() {
  return (
    <svg width="20" height="14" viewBox="0 0 28 20" aria-hidden role="img">
      <rect width="28" height="20" rx="5" fill="#FF0000" />
      <path d="M11.2 5.8 L20 10 L11.2 14.2 Z" fill="#fff" />
    </svg>
  );
}
