"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODELS,
  defaultVideoDuration,
  getVideoModel,
  videoDurations,
} from "@/config/models";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { hasMediaDrag, readMediaDrag } from "@/lib/studio/dnd";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

/**
 * Video Generator — a simplified one-shot generator: pick a model, optionally a
 * reference image (upload or drag from the Media Bucket), write a prompt, pick a
 * length (constrained to what the model actually supports), and Generate. The
 * clip is created as an AI segment on the V1 timeline and submitted to the
 * provider; it fills in when ready.
 */
export default function VideoGenPanel({ windowControls }: PanelProps) {
  const { snapshot, isAdmin, readOnly, refetch } = useProjectEditor();
  const projectId = snapshot.id;

  // Cheapest first — so the cheapest model sits at the top and is the default.
  const models = VIDEO_MODELS.filter((m) => !m.adminOnly || isAdmin)
    .slice()
    .sort((a, b) => a.pricePerSecondUsd - b.pricePerSecondUsd);
  const [model, setModel] = useState(() => models[0]?.id ?? DEFAULT_VIDEO_MODEL);
  const [prompt, setPrompt] = useState("");
  const [durationS, setDurationS] = useState(() => defaultVideoDuration(model));
  const [refAssetId, setRefAssetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const info = getVideoModel(model);
  const durations = videoDurations(model);
  const estUsd = info ? durationS * info.pricePerSecondUsd : 0;

  function pickModel(id: string) {
    setModel(id);
    // Keep the chosen length only if the new model supports it.
    const next = videoDurations(id);
    if (!next.includes(durationS)) setDurationS(defaultVideoDuration(id));
  }

  async function uploadRef(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      const res = await fetch(withBase("/api/uploads"), {
        method: "POST",
        body: fd,
        headers: { "X-Requested-With": "spotforge" },
      });
      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok || json.error || !json.data) throw new Error(json.error ?? "upload failed");
      setRefAssetId(json.data.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!prompt.trim() || busy || readOnly) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api(`/api/projects/${projectId}/generate-clip`, {
        method: "POST",
        body: JSON.stringify({ videoModel: model, prompt: prompt.trim(), durationS, refAssetId }),
      });
      await refetch();
      setDone(true);
      setPrompt("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fieldLabel = "text-[9px] font-semibold uppercase tracking-wider text-[var(--color-muted)]";
  const control =
    "w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-[11px] text-[var(--color-fg)]";

  return (
    <PanelChrome title="Video Generator" icon="✨" {...windowControls}>
      <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
        {/* Model + Length on one row */}
        <div className="flex gap-1.5">
          <div className="min-w-0 flex-1 space-y-0.5">
            <label className={fieldLabel}>Model</label>
            <select className={`${control} min-w-0`} value={model} onChange={(e) => pickModel(e.target.value)} disabled={readOnly}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · ${m.pricePerSecondUsd.toFixed(2)}/s{m.adminOnly ? " · admin" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[52px] shrink-0 space-y-0.5">
            <label className={fieldLabel}>Length</label>
            <select
              className={control}
              value={durationS}
              onChange={(e) => setDurationS(Number(e.target.value))}
              disabled={readOnly || durations.length <= 1}
            >
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </div>
        </div>
        {info?.note ? <p className="text-[9px] leading-snug text-[var(--color-muted)]">{info.note}</p> : null}

        {/* Reference image (optional) */}
        <div className="space-y-0.5">
          <label className={fieldLabel}>Reference image (optional)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadRef(f);
              e.target.value = "";
            }}
          />
          <div
            onDragOver={(e) => {
              if (hasMediaDrag(e.dataTransfer)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDragOver(true);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={(e) => {
              setDragOver(false);
              const p = readMediaDrag(e.dataTransfer);
              // A photo from the Media Bucket: not video, not audio.
              if (p && !p.isVideo && !p.isAudio) {
                e.preventDefault();
                setRefAssetId(p.id);
              }
            }}
            className={`relative flex min-h-[44px] items-center justify-center rounded border border-dashed text-center ${
              dragOver ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)]"
            }`}
          >
            {refAssetId ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={withBase(`/api/assets/${refAssetId}`)} alt="reference" className="max-h-[88px] max-w-full rounded object-contain" />
                <button
                  type="button"
                  onClick={() => setRefAssetId(null)}
                  className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded bg-black/60 text-[10px] text-white/80 hover:bg-[var(--color-danger)]"
                  title="Remove reference"
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={readOnly || uploading}
                onClick={() => fileRef.current?.click()}
                className="px-2 py-2 text-[10px] leading-snug text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-40"
              >
                {uploading ? "Uploading…" : "⬆ Upload or drag a photo here"}
              </button>
            )}
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-0.5">
          <label className={fieldLabel}>Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={readOnly}
            rows={3}
            placeholder="Describe the shot to generate…"
            className="w-full resize-y rounded border border-[#4b5468] bg-[var(--color-surface)] px-1.5 py-1 text-[11px] leading-snug text-[var(--color-fg)]"
          />
        </div>

        <div className="mt-auto space-y-1 pt-0.5">
          {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}
          {done && !error ? (
            <p className="text-[10px] text-[var(--color-success)]">Generating — it&apos;ll appear in the Media Bucket.</p>
          ) : null}
          <button
            type="button"
            onClick={generate}
            disabled={busy || readOnly || !prompt.trim()}
            className="w-full rounded bg-[var(--color-control)] px-2 py-1.5 text-xs font-medium text-[var(--color-accent-fg)] transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Submitting…" : `✨ Generate · ≈$${estUsd.toFixed(2)}`}
          </button>
        </div>
      </div>
    </PanelChrome>
  );
}
