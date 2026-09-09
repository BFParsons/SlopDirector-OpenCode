"use client";

import { type CSSProperties, type ReactNode, useRef, useState } from "react";
import { CAPS, VIDEO_MODELS, getVideoModel } from "@/config/models";
import { withBase } from "@/lib/basePath";
import type { EffectSpec } from "@/lib/render/effects";
import type { PipPlacement } from "@/lib/render/pip";
import type { ClipTransform } from "@/lib/render/transform";
import { Button, Input, Label, Select, StatusBadge, Textarea } from "@/components/ui";

export type SegmentSource =
  | "AI_GENERATED"
  | "UPLOAD_VIDEO"
  | "UPLOAD_IMAGE_STILL"
  | "UPLOAD_IMAGE_DRIVER";

export type ImageMotion =
  | "NONE"
  | "ZOOM_IN"
  | "ZOOM_OUT"
  | "PAN_LEFT"
  | "PAN_RIGHT"
  | "PAN_UP"
  | "PAN_DOWN"
  | "SUBTLE_ZOOM_IN"
  | "SUBTLE_ZOOM_OUT";

export const IMAGE_MOTIONS: { value: ImageMotion; label: string }[] = [
  { value: "NONE", label: "Static (no movement)" },
  { value: "SUBTLE_ZOOM_IN", label: "Subtle zoom in (keeps whole image)" },
  { value: "SUBTLE_ZOOM_OUT", label: "Subtle zoom out (keeps whole image)" },
  { value: "ZOOM_IN", label: "Zoom in (fills frame)" },
  { value: "ZOOM_OUT", label: "Zoom out (fills frame)" },
  { value: "PAN_LEFT", label: "Pan left" },
  { value: "PAN_RIGHT", label: "Pan right" },
  { value: "PAN_UP", label: "Pan up" },
  { value: "PAN_DOWN", label: "Pan down" },
];

export interface SegmentView {
  id: string;
  index: number;
  title: string | null;
  source: SegmentSource;
  prompt: string;
  videoModel: string | null;
  speed: number;
  durationS: number;
  sourceDurationS: number | null;
  trimStartS: number;
  imageMotion: ImageMotion;
  muted: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  transform: ClipTransform | null;
  effects: EffectSpec[] | null;
  track: number;
  audioOnly: boolean;
  library: boolean;
  offsetS: number;
  pip: PipPlacement | null;
  status: string;
  error: string | null;
  clipAssetId: string | null;
  sourceAssetId: string | null;
  refImageId: string | null;
  refRole: string | null;
  importUrl: string | null;
  importStartS: number | null;
  importEndS: number | null;
}

/** Semantic accent color per element kind — shared by the card edge and the
 *  timeline blocks so colors stay consistent. */
export function segmentHue(s: { source: SegmentSource; importUrl: string | null }): string {
  if (s.importUrl) return "#e0584a"; // YouTube
  switch (s.source) {
    case "UPLOAD_VIDEO":
      return "#2ec5c5"; // uploaded video — teal
    case "UPLOAD_IMAGE_STILL":
      return "#e0a93f"; // photo still — amber
    case "UPLOAD_IMAGE_DRIVER":
      return "#e05a9a"; // photo→AI — magenta
    default:
      return "#6d8bff"; // AI clip — accent blue
  }
}

export function fmtClock(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export type SegmentPatch = Partial<{
  prompt: string;
  videoModel: string | null;
  speed: number;
  durationS: number;
  trimStartS: number;
  imageMotion: ImageMotion;
  muted: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  transform: ClipTransform | null;
  effects: EffectSpec[];
  track: number;
  offsetS: number;
  pip: PipPlacement | null;
  refImageId: string | null;
  refRole: string | null;
}>;

const SOURCE_LABEL: Record<SegmentSource, string> = {
  AI_GENERATED: "AI clip",
  UPLOAD_VIDEO: "Uploaded video",
  UPLOAD_IMAGE_STILL: "Photo (still)",
  UPLOAD_IMAGE_DRIVER: "Photo → AI clip",
};

export function SegmentCard({
  projectId,
  segment,
  editable,
  onChange,
  onRetry,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRecut,
  isAdmin = false,
  projectVideoModel,
  position,
  dragHandle,
}: {
  projectId: string;
  segment: SegmentView;
  editable: boolean;
  onChange?: (patch: SegmentPatch) => void;
  onRetry?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRecut?: (startS: number, endS: number) => Promise<void> | void;
  isAdmin?: boolean;
  projectVideoModel?: string;
  // 1-based position in the editable list: drives the index badge and the
  // alternating stripe. Omitted in the read-only RENDERING view (plain look).
  position?: number;
  dragHandle?: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cutStart, setCutStart] = useState(segment.importStartS ?? 0);
  const [cutEnd, setCutEnd] = useState(segment.importEndS ?? 0);
  const [recutting, setRecutting] = useState(false);
  // Accordion: once a clip is imported/rendered its settings are just clutter, so
  // collapse it by default — a long list of finished clips stays scannable.
  const [collapsed, setCollapsed] = useState(() => editable && segment.status === "READY");

  async function uploadRefImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      const res = await fetch(withBase("/api/uploads"), { method: "POST", body: fd });
      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok || json.error || !json.data) throw new Error(json.error ?? "upload failed");
      onChange?.({ refImageId: json.data.id, refRole: segment.refRole ?? "FIRST_FRAME" });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const isAi = segment.source === "AI_GENERATED" || segment.source === "UPLOAD_IMAGE_DRIVER";
  // Once an AI clip is generated, the generation inputs (prompt, model, ref
  // image, driver role) are clutter — collapse them and just show the result.
  const isRendered = isAi && segment.status === "READY" && !!segment.clipAssetId;
  const isImport = !!segment.importUrl;
  const importPending = isImport && segment.status !== "READY";
  const importRange =
    segment.importStartS != null && segment.importEndS != null
      ? `${fmtClock(segment.importStartS)}–${fmtClock(segment.importEndS)}`
      : null;

  // A tiny preview frame for the collapsed header (rendered clip / source media).
  const thumbIsVideo =
    (isAi && segment.status === "READY") || segment.source === "UPLOAD_VIDEO";
  const thumbAssetId =
    isAi && segment.status === "READY"
      ? segment.clipAssetId
      : segment.sourceAssetId;

  // Alternating two-tone stripe + a type-colored, flowing accent edge (editable
  // list only). The two shades are far apart so adjacent clips read as distinct;
  // the RENDERING view passes no position and keeps the plain card look.
  const inList = position != null;
  const striped = inList && position % 2 === 0;
  const hue = segmentHue(segment);
  const edgeGradient = `linear-gradient(180deg, ${hue} 0%, color-mix(in srgb, ${hue}, #ffffff 55%) 50%, ${hue} 100%)`;
  const rootClass = inList
    ? `relative overflow-hidden rounded-xl border border-[var(--color-border)] p-4 pl-5 transition duration-200 ease-spring hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_14px_34px_-12px_var(--edge)] ${
        striped ? "bg-[#222c44]" : "bg-[#14181f]"
      }`
    : "rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4";
  const badge = position ?? segment.index + 1;

  return (
    <div data-clip-id={segment.id} className={rootClass} style={inList ? ({ "--edge": hue } as CSSProperties) : undefined}>
      {inList ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5"
          style={{
            background: edgeGradient,
            backgroundSize: "100% 200%",
            animation: "edge-flow 3.5s linear infinite",
          }}
        />
      ) : null}
      <div className={`flex items-center justify-between gap-2 ${collapsed ? "" : "mb-3"}`}>
        <div className="flex min-w-0 items-center gap-2">
          {dragHandle}
          {editable ? (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              aria-label={collapsed ? "Expand clip" : "Collapse clip"}
            >
              {collapsed ? "▸" : "▾"}
            </button>
          ) : null}
          {collapsed && thumbAssetId ? (
            thumbIsVideo ? (
              <video
                src={`${withBase(`/api/assets/${thumbAssetId}`)}#t=0.5`}
                muted
                playsInline
                preload="metadata"
                className="h-7 w-12 shrink-0 rounded object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={withBase(`/api/assets/${thumbAssetId}`)}
                alt=""
                className="h-7 w-12 shrink-0 rounded object-cover"
              />
            )
          ) : null}
          <span
            className={`truncate text-base font-semibold text-[var(--color-fg)] ${editable ? "cursor-pointer" : ""}`}
            onClick={() => editable && setCollapsed((c) => !c)}
          >
            {badge}. {isImport ? "YouTube clip" : SOURCE_LABEL[segment.source]}
            {segment.title ? ` · ${segment.title}` : ""}
            {collapsed ? (
              <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
                {segment.durationS.toFixed(1)}s
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!editable || importPending || collapsed ? <StatusBadge status={segment.status} /> : null}
          {editable ? (
            <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
              <button type="button" onClick={onMoveUp} className="px-1 hover:text-[var(--color-fg)]">↑</button>
              <button type="button" onClick={onMoveDown} className="px-1 hover:text-[var(--color-fg)]">↓</button>
              <button
                type="button"
                onClick={onRemove}
                className="px-1 hover:text-[var(--color-danger)]"
              >
                remove
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {collapsed ? null : importPending ? (
        <div className="space-y-2">
          {segment.status === "FAILED" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--color-danger)]">
                {segment.error ?? "Import failed"}
              </span>
              {onRetry ? (
                <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Importing from YouTube{importRange ? ` (${importRange})` : ""}…
            </p>
          )}
          {segment.importUrl ? (
            <a
              href={segment.importUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-[var(--color-muted)] underline"
            >
              {segment.importUrl}
            </a>
          ) : null}
        </div>
      ) : editable ? (
        <div className="space-y-3">
          {isImport ? (
            <div className="space-y-2 rounded border border-[var(--color-border)] p-2">
              <Label hint="re-cut the section from YouTube — no need to re-import">
                Clip range (seconds)
              </Label>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="number"
                  min={0}
                  value={cutStart}
                  className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                  onChange={(e) => setCutStart(Math.max(0, Math.floor(Number(e.target.value))))}
                />
                <span className="text-[var(--color-muted)]">to</span>
                <input
                  type="number"
                  min={0}
                  value={cutEnd}
                  className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                  onChange={(e) => setCutEnd(Math.max(0, Math.floor(Number(e.target.value))))}
                />
                <span className="text-xs text-[var(--color-muted)]">
                  {fmtClock(cutStart)}–{fmtClock(cutEnd)} · {Math.max(0, cutEnd - cutStart)}s
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  disabled={
                    recutting ||
                    cutEnd <= cutStart ||
                    (cutStart === (segment.importStartS ?? 0) &&
                      cutEnd === (segment.importEndS ?? 0))
                  }
                  onClick={async () => {
                    setRecutting(true);
                    try {
                      await onRecut?.(cutStart, cutEnd);
                    } finally {
                      setRecutting(false);
                    }
                  }}
                >
                  {recutting ? "Re-cutting…" : "Re-cut"}
                </Button>
              </div>
            </div>
          ) : null}
          {/* Rendered AI/driver clip — show the result, not just the prompt */}
          {isAi && segment.status === "READY" && segment.clipAssetId ? (
            <video src={withBase(`/api/assets/${segment.clipAssetId}`)} controls className="w-full rounded" />
          ) : null}
          {/* Visual preview of uploaded source */}
          {segment.source === "UPLOAD_VIDEO" && segment.sourceAssetId ? (
            <video src={withBase(`/api/assets/${segment.sourceAssetId}`)} controls className="w-full rounded" />
          ) : null}
          {/* Clip audio toggle — off by default (the VO/music is the master). */}
          {segment.source === "UPLOAD_VIDEO" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!segment.muted}
                className="accent-[var(--color-accent)]"
                onChange={(e) => onChange?.({ muted: !e.target.checked })}
              />
              Include this clip&apos;s audio in the final video
            </label>
          ) : null}
          {(segment.source === "UPLOAD_IMAGE_STILL" ||
            (segment.source === "UPLOAD_IMAGE_DRIVER" && !isRendered)) &&
          segment.sourceAssetId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={withBase(`/api/assets/${segment.sourceAssetId}`)}
              alt="segment source"
              className="max-h-40 rounded object-contain"
            />
          ) : null}

          {segment.source === "UPLOAD_IMAGE_DRIVER" && !isRendered ? (
            <p className="text-xs text-[var(--color-warning)]">
              ⚠ The AI video model rejects photos of real people. For a real
              person, use a &quot;Photo (still)&quot; segment instead — it shows the
              photo directly with no AI.
            </p>
          ) : null}

          {/* Prompt for AI / driver */}
          {isAi && !isRendered ? (
            <div>
              <Label hint={segment.source === "UPLOAD_IMAGE_DRIVER" ? "how to animate the photo" : "generic/archetypal visuals only"}>
                Video prompt
              </Label>
              <Textarea
                rows={3}
                value={segment.prompt}
                onChange={(e) => onChange?.({ prompt: e.target.value })}
              />
            </div>
          ) : null}

          {/* Per-shot AI video model (override the project default) */}
          {isAi && !isRendered ? (
            <div>
              <Label hint="mix & match per shot">AI video model</Label>
              <Select
                value={segment.videoModel ?? ""}
                onChange={(e) => onChange?.({ videoModel: e.target.value || null })}
              >
                <option value="">
                  Project default
                  {projectVideoModel
                    ? ` — ${getVideoModel(projectVideoModel)?.label ?? projectVideoModel}`
                    : ""}
                </option>
                {VIDEO_MODELS.filter((m) => isAdmin || !m.adminOnly).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {/* Playback speed — video segments only (slow-mo / speed-up) */}
          {segment.source !== "UPLOAD_IMAGE_STILL" ? (
            <div>
              <Label hint="slow-mo / speed-up">Playback speed</Label>
              <Select
                value={String(segment.speed)}
                onChange={(e) => onChange?.({ speed: Number(e.target.value) })}
              >
                {["0.5", "0.75", "1", "1.5", "2"].map((s) => (
                  <option key={s} value={s}>
                    {s}×{s === "1" ? " (normal)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {/* Duration: editable for an unrendered AI shot + stills; read-only
                for uploaded video and already-rendered AI clips. */}
            {segment.source === "UPLOAD_VIDEO" || isRendered ? (
              <div>
                <Label>Duration</Label>
                <p className="px-1 py-2 text-sm text-[var(--color-muted)]">
                  ~{segment.durationS.toFixed(1)}s {isRendered ? "(rendered)" : "(from file)"}
                </p>
              </div>
            ) : (
              <div>
                <Label hint={isAi ? `${CAPS.minShotDurationS}–${CAPS.maxShotDurationS}s` : "seconds"}>
                  Duration
                </Label>
                <Input
                  type="number"
                  step={0.1}
                  min={isAi ? CAPS.minShotDurationS : 1}
                  max={isAi ? CAPS.maxShotDurationS : 120}
                  value={segment.durationS}
                  onChange={(e) => onChange?.({ durationS: Number(e.target.value) })}
                />
              </div>
            )}

            {/* Pan/scan/zoom for stills */}
            {segment.source === "UPLOAD_IMAGE_STILL" ? (
              <div>
                <Label hint="pan / scan / zoom">Motion</Label>
                <Select
                  value={segment.imageMotion}
                  onChange={(e) =>
                    onChange?.({ imageMotion: e.target.value as ImageMotion })
                  }
                >
                  {IMAGE_MOTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {/* Driver role for photo-driver */}
            {segment.source === "UPLOAD_IMAGE_DRIVER" && !isRendered ? (
              <div>
                <Label>Use photo as</Label>
                <Select
                  value={segment.refRole ?? "FIRST_FRAME"}
                  onChange={(e) => onChange?.({ refRole: e.target.value })}
                >
                  <option value="FIRST_FRAME">First frame</option>
                  <option value="LAST_FRAME">Last frame</option>
                  <option value="STYLE">Style reference</option>
                </Select>
              </div>
            ) : null}
          </div>

          {/* Per-segment color adjustments (applied before the project look) */}
          <AdjustControls segment={segment} onChange={onChange} />

          {/* Optional reference image for pure AI segments */}
          {segment.source === "AI_GENERATED" && !isRendered ? (
            <div className="flex items-center gap-3">
              {segment.refImageId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withBase(`/api/assets/${segment.refImageId}`)}
                  alt="reference"
                  className="h-12 w-12 rounded object-cover"
                />
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadRefImage(f);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Uploading…" : segment.refImageId ? "Replace ref image" : "+ Reference image"}
              </Button>
              {segment.refImageId ? (
                <Select
                  className="w-auto"
                  value={segment.refRole ?? "FIRST_FRAME"}
                  onChange={(e) => onChange?.({ refRole: e.target.value })}
                >
                  <option value="FIRST_FRAME">First frame</option>
                  <option value="LAST_FRAME">Last frame</option>
                  <option value="STYLE">Style</option>
                </Select>
              ) : null}
              {segment.refImageId ? (
                <button
                  type="button"
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => onChange?.({ refImageId: null, refRole: null })}
                >
                  remove
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {isAi && segment.prompt ? (
            <p className="text-sm text-[var(--color-muted)]">{segment.prompt}</p>
          ) : null}
          {/* Result / source preview */}
          {segment.status === "READY" && segment.clipAssetId ? (
            <video src={withBase(`/api/assets/${segment.clipAssetId}`)} controls className="w-full rounded" />
          ) : segment.source === "UPLOAD_VIDEO" && segment.sourceAssetId ? (
            <video src={withBase(`/api/assets/${segment.sourceAssetId}`)} controls className="w-full rounded" />
          ) : segment.source === "UPLOAD_IMAGE_STILL" && segment.sourceAssetId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBase(`/api/assets/${segment.sourceAssetId}`)} alt="still" className="w-full rounded object-contain" />
          ) : null}
          {segment.status === "FAILED" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--color-danger)]">
                {segment.error ?? "failed"}
              </span>
              {isAi && onRetry ? (
                <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Brightness / contrast / saturation sliders for one segment, with a reset. */
function AdjustControls({
  segment,
  onChange,
}: {
  segment: SegmentView;
  onChange?: (patch: SegmentPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const touched =
    segment.brightness !== 0 || segment.contrast !== 1 || segment.saturation !== 1;

  return (
    <div className="rounded border border-[var(--color-border)] p-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-xs font-medium text-[var(--color-muted)]"
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          Color adjustments{touched ? <span className="ml-1 text-[var(--color-accent)]">•</span> : null}
        </span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <Slider
            label="Brightness"
            min={-0.3}
            max={0.3}
            step={0.01}
            value={segment.brightness}
            fmt={(v) => v.toFixed(2)}
            onChange={(brightness) => onChange?.({ brightness })}
          />
          <Slider
            label="Contrast"
            min={0.5}
            max={1.5}
            step={0.01}
            value={segment.contrast}
            fmt={(v) => `${v.toFixed(2)}×`}
            onChange={(contrast) => onChange?.({ contrast })}
          />
          <Slider
            label="Saturation"
            min={0}
            max={2}
            step={0.01}
            value={segment.saturation}
            fmt={(v) => `${v.toFixed(2)}×`}
            onChange={(saturation) => onChange?.({ saturation })}
          />
          {touched ? (
            <button
              type="button"
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              onClick={() => onChange?.({ brightness: 0, contrast: 1, saturation: 1 })}
            >
              Reset
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Compact labeled range slider with a live numeric readout. */
export function Slider({
  label,
  min,
  max,
  step,
  value,
  fmt,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-[var(--color-muted)]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="flex-1 accent-[var(--color-accent)]"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-12 shrink-0 text-right font-mono tnum text-[var(--color-muted)]">
        {fmt(value)}
      </span>
    </div>
  );
}
