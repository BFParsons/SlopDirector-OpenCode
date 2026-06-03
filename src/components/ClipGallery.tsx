"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { Button } from "@/components/ui";

interface GalleryAsset {
  id: string;
  kind: "SHOT_CLIP" | "UPLOAD_VIDEO" | "UPLOAD_IMAGE";
  mime: string;
  sizeBytes: number;
  createdAt: string;
  isVideo: boolean;
  inUse: boolean;
  fromCurrent: boolean;
  projectTitle: string;
}

const KIND_LABEL: Record<GalleryAsset["kind"], string> = {
  SHOT_CLIP: "AI clip",
  UPLOAD_VIDEO: "Video",
  UPLOAD_IMAGE: "Photo",
};

/**
 * Modal gallery of the user's reusable visual assets across ALL their projects.
 * Selecting one appends a new segment (no AI re-bill): videos become an
 * UPLOAD_VIDEO segment, photos an UPLOAD_IMAGE_STILL. Assets from another
 * project are copied into this one on insert (server-side).
 */
export function ClipGallery({
  projectId,
  maxInserts,
  onClose,
}: {
  projectId: string;
  maxInserts: number;
  onClose: (insertedCount: number) => void;
}) {
  const [assets, setAssets] = useState<GalleryAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const insertedCount = Object.values(added).reduce((a, b) => a + b, 0);
  const slotsLeft = Math.max(0, maxInserts - insertedCount);
  const atCap = slotsLeft <= 0;

  useEffect(() => {
    let alive = true;
    api<GalleryAsset[]>(`/api/projects/${projectId}/clips`)
      .then((d) => alive && setAssets(d))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function insert(a: GalleryAsset) {
    if (atCap) return;
    setBusyId(a.id);
    setError(null);
    try {
      const body = a.isVideo
        ? { source: "UPLOAD_VIDEO", sourceAssetId: a.id }
        : { source: "UPLOAD_IMAGE_STILL", sourceAssetId: a.id, durationS: 5 };
      await api(`/api/projects/${projectId}/segments`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAdded((m) => ({ ...m, [a.id]: (m[a.id] ?? 0) + 1 }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => onClose(insertedCount)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <div>
            <h2 className="text-sm font-semibold">Reuse a clip</h2>
            <p className="text-xs text-[var(--color-muted)]">
              {insertedCount > 0 ? `${insertedCount} added · ` : ""}
              {slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left
            </p>
          </div>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            onClick={() => onClose(insertedCount)}
          >
            Done
          </Button>
        </div>

        <div className="overflow-y-auto p-4">
          {error ? (
            <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>
          ) : null}
          {assets == null ? (
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No clips, videos, or photos in your projects yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {assets.map((a) => {
                const count = added[a.id] ?? 0;
                return (
                  <div
                    key={a.id}
                    className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]"
                  >
                    <div className="flex aspect-video items-center justify-center bg-black/30">
                      {a.isVideo ? (
                        <video
                          src={withBase(`/api/assets/${a.id}`)}
                          muted
                          preload="metadata"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={withBase(`/api/assets/${a.id}`)}
                          alt="asset"
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 p-2">
                      <span className="truncate text-xs text-[var(--color-muted)]">
                        {KIND_LABEL[a.kind]}
                        {a.fromCurrent
                          ? a.inUse
                            ? " · in timeline"
                            : ""
                          : ` · from ${a.projectTitle}`}
                      </span>
                      <Button
                        variant="ghost"
                        className="shrink-0 px-2 py-1 text-xs"
                        disabled={busyId === a.id || atCap}
                        onClick={() => void insert(a)}
                      >
                        {count > 0 ? `Added${count > 1 ? ` ×${count}` : ""} · +` : "Insert"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {atCap ? (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Segment limit reached.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
