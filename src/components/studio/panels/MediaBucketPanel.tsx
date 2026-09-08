"use client";

import { useCallback, useRef, useState } from "react";
import { CAPS } from "@/config/models";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { setMediaDrag, readAudioDrag, hasAudioDrag, type AudioStudioDragPayload } from "@/lib/studio/dnd";
import { OptionDrawer } from "../OptionDrawer";
import { useProjectStore } from "@/stores/projectStore";
import { YouTubeImport } from "@/components/YouTubeImport";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

interface MediaAsset {
  id: string;
  kind: "SHOT_CLIP" | "UPLOAD_VIDEO" | "UPLOAD_IMAGE" | "UPLOAD_AUDIO";
  mime: string;
  sizeBytes: number;
  createdAt: string;
  isVideo: boolean;
  isAudio?: boolean;
  inUse: boolean;
  fromCurrent: boolean;
  projectTitle: string;
  durationS?: number;
  // Generated (library) items — a clip/voiceover from the AI panels, kept in the
  // bucket (not the timeline) until placed.
  segId?: string;
  generating?: boolean;
  failed?: boolean;
  isNew?: boolean;
}

function fmtDur(s?: number): string {
  if (!s || s <= 0) return "";
  const t = Math.round(s);
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

const seenKey = (projectId: string) => `slop:bucket-seen:${projectId}`;
function loadSeen(projectId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(seenKey(projectId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

const KIND_LABEL: Record<MediaAsset["kind"], string> = {
  SHOT_CLIP: "AI clip",
  UPLOAD_VIDEO: "Video",
  UPLOAD_IMAGE: "Photo",
  UPLOAD_AUDIO: "Audio",
};

type Filter = "all" | MediaAsset["kind"];
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "SHOT_CLIP", label: "AI clips" },
  { key: "UPLOAD_VIDEO", label: "Video" },
  { key: "UPLOAD_IMAGE", label: "Photo" },
  { key: "UPLOAD_AUDIO", label: "Audio" },
];

function YtMark() {
  return (
    <svg width="11" height="8" viewBox="0 0 28 20" aria-hidden role="img">
      <rect width="28" height="20" rx="5" fill="#FF0000" />
      <path d="M11.2 5.8 L20 10 L11.2 14.2 Z" fill="#fff" />
    </svg>
  );
}

function fmtSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// The bucket holds only what the user explicitly imported, persisted per-project
// so a reload doesn't re-trigger a heavy library load. Keyed by project id.
const bucketKey = (projectId: string) => `slop:bucket:${projectId}`;

function loadBucket(projectId: string): MediaAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(bucketKey(projectId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as MediaAsset[]) : [];
  } catch {
    return [];
  }
}

function persistBucket(projectId: string, items: MediaAsset[]) {
  try {
    window.localStorage.setItem(bucketKey(projectId), JSON.stringify(items));
  } catch {
    /* quota / unavailable — bucket just won't persist */
  }
}

/**
 * Media Bucket — a per-project shelf of media the user has *explicitly* imported:
 * machine uploads, YouTube grabs, or clips reused from other projects (via Browse).
 * It starts EMPTY and never auto-loads the whole cross-project asset library — that
 * was rendering a <video> per asset across every project and exhausting memory.
 * Only items added here load a thumbnail; the Browse picker is a lightweight,
 * media-free list. Contents persist in localStorage per project.
 */
export default function MediaBucketPanel({ windowControls }: PanelProps) {
  const { snapshot, draft, readOnly, save, refetch, insertMedia, openInVideoEdit, onDeleteSegment } =
    useProjectEditor();
  const projectId = snapshot.id;

  // Restore this project's bucket (empty for a fresh project). No network call;
  // panels render client-only so reading localStorage in the initializer is safe.
  const [items, setItems] = useState<MediaAsset[]>(() => loadBucket(projectId));
  // Generated items the user has already placed (so the "new" twinkle clears).
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen(projectId));
  const markSeen = useCallback(
    (segId: string) => {
      setSeen((prev) => {
        const next = new Set(prev);
        next.add(segId);
        try {
          window.localStorage.setItem(seenKey(projectId), JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [projectId],
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [showYouTube, setShowYouTube] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; asset: MediaAsset } | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [library, setLibrary] = useState<MediaAsset[] | null>(null);
  const [libError, setLibError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addItems = useCallback(
    (incoming: MediaAsset[]) => {
      setItems((prev) => {
        const have = new Set(prev.map((a) => a.id));
        const merged = [...prev, ...incoming.filter((a) => a.id && !have.has(a.id))];
        persistBucket(projectId, merged);
        return merged;
      });
    },
    [projectId],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((a) => a.id !== id);
        persistBucket(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  // Drop an Audio Studio workspace track here → register it as an Asset on the shelf.
  const [audioDrop, setAudioDrop] = useState(false);
  const importAudioFromStudio = useCallback(
    async (p: AudioStudioDragPayload) => {
      setError(null);
      try {
        const res = await api<{ id: string }>("/api/audio/to-asset", {
          method: "POST",
          body: JSON.stringify({ projectId, relPath: p.relPath }),
        });
        addItems([
          {
            id: res.id,
            kind: "UPLOAD_AUDIO",
            mime: "audio/mpeg",
            sizeBytes: 0,
            createdAt: new Date().toISOString(),
            isVideo: false,
            isAudio: true,
            durationS: p.durationS,
            inUse: false,
            fromCurrent: true,
            projectTitle: "",
          },
        ]);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [projectId, addItems],
  );

  const atMax = draft.segments.length >= CAPS.maxSegments;

  // Add a bucket item to the end of the V1 timeline (or drag it onto a lane).
  async function add(a: MediaAsset) {
    if (readOnly || atMax || a.generating || a.failed) return;
    setBusyId(a.id);
    setError(null);
    try {
      await insertMedia({ id: a.id, isVideo: a.isVideo, isAudio: a.isAudio });
      if (a.segId) markSeen(a.segId); // placed → no longer "new"
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  // Remove: a generated (library) item deletes its segment; an imported item just
  // leaves the bucket shelf (the asset file stays).
  function removeAsset(a: MediaAsset) {
    if (a.segId) void onDeleteSegment(a.segId);
    else removeItem(a.id);
  }

  // Upload from the machine → lands in the bucket (not the timeline) for reuse.
  async function onUpload(file: File) {
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
      const json = (await res.json()) as {
        data?: { id: string; mime?: string; sizeBytes?: number; durationS?: number };
        error?: string;
      };
      if (!res.ok || json.error || !json.data) throw new Error(json.error ?? "upload failed");
      const isVideo = file.type.startsWith("video");
      const isAudio = file.type.startsWith("audio");
      addItems([
        {
          id: json.data.id,
          kind: isVideo ? "UPLOAD_VIDEO" : isAudio ? "UPLOAD_AUDIO" : "UPLOAD_IMAGE",
          mime: json.data.mime ?? file.type,
          sizeBytes: json.data.sizeBytes ?? file.size,
          createdAt: new Date().toISOString(),
          isVideo,
          isAudio,
          durationS: json.data.durationS,
          inUse: false,
          fromCurrent: true,
          projectTitle: "",
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // After a YouTube import, pull this project's own assets into the bucket so the
  // freshly imported clip shows up (a small, current-project-only fetch).
  async function pullCurrentAssets() {
    try {
      const all = await api<MediaAsset[]>(`/api/projects/${projectId}/clips`);
      addItems(all.filter((a) => a.fromCurrent));
    } catch {
      /* ignore — user can Browse to add it manually */
    }
  }

  function openBrowse() {
    setBrowseOpen(true);
    if (library == null) {
      setLibError(null);
      api<MediaAsset[]>(`/api/projects/${projectId}/clips`)
        .then(setLibrary)
        .catch((e) => setLibError((e as Error).message));
    }
  }

  // Generated clips/voiceovers live as "library" segments — surface them here
  // ahead of the imported items. Read the LIVE project-store snapshot (not the
  // keyed draft) so generation status updates as the worker polls finish.
  const liveSegments = useProjectStore((s) => s.snapshot?.segments) ?? draft.segments;
  const genItems: MediaAsset[] = liveSegments
    .filter((s) => s.library)
    .map((s): MediaAsset => {
      const base = {
        mime: s.audioOnly ? "audio/mpeg" : "video/mp4",
        sizeBytes: 0,
        createdAt: "",
        inUse: false,
        fromCurrent: true,
        projectTitle: "",
        durationS: s.durationS,
        segId: s.id,
        isNew: !seen.has(s.id),
      };
      if (s.audioOnly) {
        return { ...base, id: s.sourceAssetId ?? s.id, kind: "UPLOAD_AUDIO", isVideo: false, isAudio: true };
      }
      const ready = s.status === "READY" && !!s.clipAssetId;
      return {
        ...base,
        id: ready ? (s.clipAssetId as string) : s.id,
        kind: "SHOT_CLIP",
        isVideo: true,
        isAudio: false,
        generating: !ready && s.status !== "FAILED",
        failed: s.status === "FAILED",
      };
    });

  const displayed = [...genItems, ...items];
  const inBucket = new Set(items.map((a) => a.id));
  const list = displayed.filter((a) => filter === "all" || a.kind === filter);
  const importBtn =
    "flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[8px] text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <PanelChrome title="Media Bucket" icon="🗂" {...windowControls}>
      <div className="flex h-full flex-col">
        {/* Import row */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border)] p-2">
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,video/mpeg,video/mp2t,video/x-m4v,video/3gpp,.mkv,.avi,.mpg,.mpeg,.ts,.mts,.m2ts,.m4v,.3gp,image/png,image/jpeg,image/webp,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              e.target.value = "";
            }}
          />
          <button type="button" className={importBtn} disabled={readOnly || uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "⬆ Upload"}
          </button>
          <button
            type="button"
            className={importBtn}
            disabled={readOnly}
            onClick={async () => {
              if (await save()) setShowYouTube(true);
            }}
          >
            <YtMark /> YouTube
          </button>
          <button type="button" className={importBtn} onClick={openBrowse} title="Reuse media from your other projects">
            🔎 Assets
          </button>
        </div>

        {/* Filter (collapsed drawer for density) */}
        <div className="shrink-0 border-b border-[var(--color-border)] p-2">
          <OptionDrawer
            className="w-44"
            label="Show"
            value={filter}
            options={FILTERS}
            onChange={(k) => setFilter(k as Filter)}
          />
        </div>

        {/* Bucket grid — only explicitly imported items render a thumbnail */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto p-2 ${audioDrop ? "ring-2 ring-inset ring-[var(--color-accent)]" : ""}`}
          onDragOver={(e) => {
            if (hasAudioDrag(e.dataTransfer)) {
              e.preventDefault();
              setAudioDrop(true);
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setAudioDrop(false);
          }}
          onDrop={(e) => {
            const p = readAudioDrag(e.dataTransfer);
            if (p) {
              e.preventDefault();
              setAudioDrop(false);
              void importAudioFromStudio(p);
            }
          }}
        >
          {error ? <p className="mb-2 text-[8px] text-[var(--color-danger)]">{error}</p> : null}
          {list.length === 0 ? (
            <p className="text-[8px] text-[var(--color-muted)]">
              {displayed.length === 0
                ? "Your bucket is empty. Generate AI video/voiceover, upload a file, grab a YouTube clip, or Browse to reuse media."
                : "Nothing matches this filter."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {list.map((a) => {
                const draggable = !readOnly && !a.generating && !a.failed;
                return (
                  <div
                    key={a.segId ?? a.id}
                    draggable={draggable}
                    onDragStart={(e) => {
                      if (draggable) setMediaDrag(e.dataTransfer, { id: a.id, isVideo: a.isVideo, isAudio: a.isAudio });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenu({ x: e.clientX, y: e.clientY, asset: a });
                    }}
                    title="Drag onto the timeline or Video Edit, right-click for options, or use + Add"
                    className={`group relative overflow-hidden rounded-md border bg-[var(--color-card)] ${
                      a.isNew ? "border-[var(--color-accent)]/60" : "border-[var(--color-border)]"
                    } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    {a.isNew ? (
                      <span className="absolute right-1 top-1 z-10 text-[8px] drop-shadow" title="New">
                        ✨
                      </span>
                    ) : null}
                    <button
                      type="button"
                      title={a.segId ? "Remove generated clip" : "Remove from bucket (does not delete the file)"}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAsset(a);
                      }}
                      className="absolute left-1 top-1 z-10 flex h-3 w-3 items-center justify-center rounded bg-black/55 text-[7px] text-white/80 opacity-0 transition-opacity hover:bg-[var(--color-danger)] group-hover:opacity-100"
                    >
                      ✕
                    </button>
                    <BucketThumb item={a} />
                    <div className="flex items-center justify-between gap-1 p-1.5">
                      <span className="min-w-0 truncate text-[7px] text-[var(--color-muted)]" title={a.fromCurrent ? "" : a.projectTitle}>
                        {KIND_LABEL[a.kind]}
                        {!a.fromCurrent && a.projectTitle ? ` · ${a.projectTitle}` : ""}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === a.id || atMax || readOnly || a.generating || a.failed}
                        onClick={() => void add(a)}
                        className="shrink-0 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[7px] text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-40"
                      >
                        {busyId === a.id ? "…" : "+ Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {atMax ? (
            <p className="mt-2 text-[8px] text-[var(--color-muted)]">Segment limit reached ({CAPS.maxSegments}).</p>
          ) : null}
        </div>
      </div>

      {/* Right-click context menu for a bucket item */}
      {menu ? (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div
            className="fixed z-[61] min-w-[170px] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)] py-1 text-[8px] shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            {menu.asset.isVideo && !menu.asset.generating && !menu.asset.failed ? (
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
                onClick={() => {
                  openInVideoEdit(menu.asset.id);
                  setMenu(null);
                }}
              >
                ✂ Open in Video Edit
              </button>
            ) : null}
            <button
              type="button"
              disabled={atMax || readOnly || menu.asset.generating || menu.asset.failed}
              className="block w-full px-3 py-1.5 text-left text-[var(--color-fg)] hover:bg-[var(--color-surface)] disabled:opacity-40"
              onClick={() => {
                void add(menu.asset);
                setMenu(null);
              }}
            >
              ＋ Add to timeline
            </button>
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[var(--color-danger)] hover:bg-[var(--color-surface)]"
              onClick={() => {
                removeAsset(menu.asset);
                setMenu(null);
              }}
            >
              {menu.asset.segId ? "🗑 Remove generated clip" : "✕ Remove from bucket"}
            </button>
          </div>
        </>
      ) : null}

      {/* Browse picker — lightweight, media-free list of reusable assets */}
      {browseOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setBrowseOpen(false)}>
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
              <span className="text-[8px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Reuse media from your projects</span>
              <button type="button" className="text-[var(--color-muted)] hover:text-[var(--color-fg)]" onClick={() => setBrowseOpen(false)}>
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {libError ? (
                <p className="p-3 text-[8px] text-[var(--color-danger)]">{libError}</p>
              ) : library == null ? (
                <p className="p-3 text-[8px] text-[var(--color-muted)]">Loading your media library…</p>
              ) : library.length === 0 ? (
                <p className="p-3 text-[8px] text-[var(--color-muted)]">No reusable media found yet.</p>
              ) : (
                library.map((a) => {
                  const added = inBucket.has(a.id);
                  return (
                    <div key={a.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--color-surface)]">
                      <span className="text-[11px]" aria-hidden>
                        {a.isAudio ? "🎵" : a.isVideo ? "🎞️" : "🖼️"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[8px] text-[var(--color-fg)]">
                          {KIND_LABEL[a.kind]}
                          {!a.fromCurrent && a.projectTitle ? ` · ${a.projectTitle}` : a.fromCurrent ? " · this project" : ""}
                        </div>
                        <div className="text-[7px] text-[var(--color-muted)]">{fmtSize(a.sizeBytes)}</div>
                      </div>
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => addItems([a])}
                        className="shrink-0 rounded border border-[var(--color-border)] px-2 py-0.5 text-[7px] text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-40"
                      >
                        {added ? "Added" : "+ Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="shrink-0 border-t border-[var(--color-border)] px-3 py-2 text-right">
              <button
                type="button"
                className="rounded bg-[var(--color-control)] px-3 py-1 text-[8px] font-medium text-[var(--color-accent-fg)] hover:brightness-110"
                onClick={() => setBrowseOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showYouTube ? (
        <YouTubeImport
          projectId={projectId}
          onClose={async (imported) => {
            setShowYouTube(false);
            if (imported) {
              await refetch();
              await pullCurrentAssets();
            }
          }}
        />
      ) : null}
    </PanelChrome>
  );
}

/** A bucket item's preview tile. Reads the clip's duration from the media
 *  element's metadata (so even Browse-reused items get the length overlay),
 *  falling back to a known durationS. */
function BucketThumb({ item }: { item: MediaAsset }) {
  const [dur, setDur] = useState<number | undefined>(item.durationS);
  const onMeta = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const d = e.currentTarget.duration;
    if (Number.isFinite(d) && d > 0) setDur(d);
  };
  const label = fmtDur(dur);
  const src = withBase(`/api/assets/${item.id}`);
  return (
    <div className="relative flex aspect-video items-center justify-center bg-black/40">
      {item.generating ? (
        <span className="flex flex-col items-center gap-1 text-[7px] text-[var(--color-muted)]">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          Generating…
        </span>
      ) : item.failed ? (
        <span className="text-[7px] text-[var(--color-danger)]">Failed</span>
      ) : item.isAudio ? (
        <>
          <span className="text-[17px]" aria-hidden>
            🎵
          </span>
          <audio src={src} preload="metadata" onLoadedMetadata={onMeta} className="hidden" />
        </>
      ) : item.isVideo ? (
        <video
          src={`${src}#t=0.5`}
          muted
          playsInline
          preload="metadata"
          draggable={false}
          onLoadedMetadata={onMeta}
          className="pointer-events-none h-full w-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full object-contain" />
      )}
      {label && (item.isVideo || item.isAudio) && !item.generating && !item.failed ? (
        <span className="pointer-events-none absolute bottom-0.5 right-1 rounded bg-black/55 px-1 font-mono text-[8px] leading-tight text-white">
          {label}
        </span>
      ) : null}
    </div>
  );
}
