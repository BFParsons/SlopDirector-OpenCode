"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";
import { useAudioStudioStore } from "@/stores/audioStudioStore";
import { hasMediaDrag, readMediaDrag, setAudioDrag } from "@/lib/studio/dnd";
import { pollAudioJob } from "@/lib/audio/jobClient";

interface UploadResult {
  relPath: string;
  name: string;
  durationS: number;
  url: string;
}

function fmtDur(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** The audio bucket importer — drag-drop or pick audio files into the studio. */
export default function AudioImporterPanel({ windowControls }: PanelProps) {
  const { snapshot } = useProjectEditor();
  const projectId = snapshot.id;
  const tracks = useAudioStudioStore((s) => s.tracks);
  const addTrack = useAudioStudioStore((s) => s.addTrack);
  const removeTrack = useAudioStudioStore((s) => s.removeTrack);
  const select = useAudioStudioStore((s) => s.select);
  const selectedTrackId = useAudioStudioStore((s) => s.selectedTrackId);
  const setProject = useAudioStudioStore((s) => s.setProject);
  useEffect(() => {
    setProject(projectId);
  }, [projectId, setProject]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      setBusy(true);
      try {
        for (const file of Array.from(files)) {
          const form = new FormData();
          form.append("projectId", projectId);
          form.append("file", file);
          const res = await api<UploadResult>("/api/audio/upload", { method: "POST", body: form });
          addTrack({ name: res.name, relPath: res.relPath, url: res.url, durationS: res.durationS, kind: "import" });
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [projectId, addTrack],
  );

  // Bring a Media Bucket audio asset into the workspace (copy → addTrack).
  const importAsset = useCallback(
    async (assetId: string) => {
      setError(null);
      setBusy(true);
      try {
        const res = await api<UploadResult>("/api/audio/from-asset", {
          method: "POST",
          body: JSON.stringify({ projectId, assetId }),
        });
        addTrack({ name: res.name, relPath: res.relPath, url: res.url, durationS: res.durationS, kind: "import" });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [projectId, addTrack],
  );

  // Whole-panel drop: OS files upload; a Media Bucket audio asset is copied in.
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) {
        void uploadFiles(e.dataTransfer.files);
        return;
      }
      const media = readMediaDrag(e.dataTransfer);
      if (media?.isAudio) void importAsset(media.id);
    },
    [uploadFiles, importAsset],
  );

  // YouTube → mp3 import (job-based; lands as a normal imported track).
  const [ytUrl, setYtUrl] = useState("");
  const [ytBusy, setYtBusy] = useState(false);
  const [ytMsg, setYtMsg] = useState("");
  async function importYouTube() {
    const url = ytUrl.trim();
    if (!url || ytBusy) return;
    setYtBusy(true);
    setError(null);
    setYtMsg("Starting…");
    try {
      const { jobId } = await api<{ jobId: string }>("/api/audio/youtube", {
        method: "POST",
        body: JSON.stringify({ projectId, url }),
      });
      const job = await pollAudioJob(jobId, (j) => setYtMsg(j.message));
      const r = job.result as { name: string; relPath: string; durationS: number; url: string };
      addTrack({ name: r.name, relPath: r.relPath, url: r.url, durationS: r.durationS, kind: "import" });
      setYtUrl("");
      setYtMsg("");
    } catch (e) {
      setError((e as Error).message);
      setYtMsg("");
    } finally {
      setYtBusy(false);
    }
  }

  return (
    <PanelChrome title="Audio Importer" icon="🗂" {...windowControls}>
      <div
        className="flex h-full flex-col gap-2 p-3"
        onDragOver={(e) => {
          if (e.dataTransfer.files?.length || hasMediaDrag(e.dataTransfer)) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={onDrop}
      >
        <div
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-center transition-colors ${
            dragOver ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] hover:border-[#39414f]"
          }`}
        >
          <span className="text-lg">⬇</span>
          <span className="text-xs font-medium">{busy ? "Uploading…" : "Drop audio here or click to import"}</span>
          <span className="text-[10px] text-[var(--color-muted)]">mp3 · wav · m4a · flac · ogg · aac (max 200 MB)</span>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac,.opus"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* YouTube → mp3 */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void importYouTube();
            }}
            placeholder="Paste a YouTube URL → mp3"
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void importYouTube()}
            disabled={ytBusy || !ytUrl.trim()}
            className="shrink-0 rounded-md bg-[var(--color-accent)] px-2.5 py-1.5 text-xs font-medium text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {ytBusy ? "Importing…" : "Import"}
          </button>
        </div>
        {ytMsg ? <p className="text-[11px] text-[var(--color-muted)]">{ytMsg}</p> : null}

        {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}

        <div className="min-h-0 flex-1 space-y-1 overflow-auto">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Bucket ({tracks.length})
            </span>
          </div>
          {tracks.length === 0 ? (
            <p className="px-1 py-3 text-[11px] text-[var(--color-muted)]">No audio yet — import a file to begin.</p>
          ) : (
            tracks.map((t) => (
              <button
                key={t.id}
                type="button"
                draggable
                onDragStart={(e) =>
                  setAudioDrag(e.dataTransfer, { relPath: t.relPath, name: t.name, durationS: t.durationS, url: t.url })
                }
                onClick={() => select(t.id)}
                title="Drag onto the Media Bucket or the video timeline"
                className={`flex w-full cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors active:cursor-grabbing ${
                  selectedTrackId === t.id ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] hover:border-[#39414f]"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="min-w-0 flex-1 truncate text-xs">{t.name}</span>
                {t.kind !== "import" ? (
                  <span className="shrink-0 rounded bg-[var(--color-border)] px-1 text-[9px] uppercase text-[var(--color-muted)]">{t.kind}</span>
                ) : null}
                <span className="shrink-0 font-mono tnum text-[10px] text-[var(--color-muted)]">{fmtDur(t.durationS)}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTrack(t.id);
                  }}
                  className="shrink-0 px-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  title="Remove from bucket"
                >
                  ✕
                </span>
              </button>
            ))
          )}
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">
          Imported audio is shared across all Audio Studio panels — separate, process, mix, or visualize any track.
        </p>
      </div>
    </PanelChrome>
  );
}
