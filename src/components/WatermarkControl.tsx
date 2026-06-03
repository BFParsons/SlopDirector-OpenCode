"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { Button, Input, Label, Select } from "@/components/ui";
import { OVERLAY_POSITIONS } from "./TextOverlaySection";

export interface WatermarkDraft {
  watermarkPosition: string;
  watermarkScale: number;
  watermarkOpacity: number;
  watermarkMargin: number;
}

export function WatermarkControl({
  projectId,
  watermarkAssetId,
  draft,
  readOnly,
  onChange,
  save,
  refetch,
}: {
  projectId: string;
  watermarkAssetId: string | null;
  draft: WatermarkDraft;
  readOnly: boolean;
  onChange: (patch: Partial<WatermarkDraft>) => void;
  save: () => Promise<boolean>;
  refetch: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!(await save())) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/projects/${projectId}/watermark`, { method: "POST", body: fd });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    if (!(await save())) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/watermark`, { method: "DELETE" });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {watermarkAssetId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withBase(`/api/assets/${watermarkAssetId}`)}
            alt="watermark"
            className="h-12 w-12 rounded border border-[var(--color-border)] object-contain"
          />
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          className="px-3 py-1.5 text-xs"
          disabled={readOnly || busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "…" : watermarkAssetId ? "Replace logo" : "+ Upload logo / watermark"}
        </Button>
        {watermarkAssetId ? (
          <button
            type="button"
            disabled={readOnly || busy}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
            onClick={remove}
          >
            remove
          </button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}

      {watermarkAssetId ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <Label>Position</Label>
            <Select
              value={draft.watermarkPosition}
              disabled={readOnly}
              onChange={(e) => onChange({ watermarkPosition: e.target.value })}
            >
              {OVERLAY_POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label hint={`${Math.round(draft.watermarkScale * 100)}% wide`}>Size</Label>
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.01}
              value={draft.watermarkScale}
              disabled={readOnly}
              className="w-full accent-[var(--color-accent)]"
              onChange={(e) => onChange({ watermarkScale: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label hint={`${Math.round(draft.watermarkOpacity * 100)}%`}>Opacity</Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.watermarkOpacity}
              disabled={readOnly}
              className="w-full accent-[var(--color-accent)]"
              onChange={(e) => onChange({ watermarkOpacity: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label hint="px from edge">Margin</Label>
            <Input
              type="number"
              min={0}
              max={400}
              value={draft.watermarkMargin}
              disabled={readOnly}
              onChange={(e) =>
                onChange({
                  watermarkMargin: Math.min(400, Math.max(0, Math.round(Number(e.target.value) || 0))),
                })
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
