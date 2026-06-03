"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";
import { useAudioStudioStore } from "@/stores/audioStudioStore";

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

  return (
    <PanelChrome title="Audio Importer" icon="🗂" {...windowControls}>
      <div className="flex h-full flex-col gap-2 p-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
          }}
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
                onClick={() => select(t.id)}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
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
