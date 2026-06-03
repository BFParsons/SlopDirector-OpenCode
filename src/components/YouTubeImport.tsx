"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { parseYouTubeId } from "@/lib/youtube/url";
import { Button, Input, Label } from "@/components/ui";

// Mirrors the server's YT_IMPORT_MAX_SECONDS default; the server is authoritative.
const MAX_CLIP_SECONDS = 180;

interface YTPlayer {
  getDuration(): number;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number>;
      events?: {
        onReady?: () => void;
        onError?: () => void;
      };
    },
  ) => YTPlayer;
};
function ytGlobal() {
  return window as unknown as {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  };
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (ytGlobal().YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = ytGlobal().onYouTubeIframeAPIReady;
    ytGlobal().onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

function fmt(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function YouTubeImport({
  projectId,
  onClose,
  mode = "video",
}: {
  projectId: string;
  onClose: (imported: boolean) => void;
  // "video" → adds a visual segment; "audio" → adds an audio overlay.
  mode?: "video" | "audio";
}) {
  const isAudio = mode === "audio";
  const [url, setUrl] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [startS, setStartS] = useState(0);
  const [endS, setEndS] = useState(15);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const previewEndRef = useRef<number | null>(null);

  // Build / tear down the player when a video id is loaded.
  useEffect(() => {
    if (!loadedId || !mountRef.current) return;
    let cancelled = false;
    setReady(false);
    setError(null);
    void loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current) return;
      const YT = ytGlobal().YT;
      if (!YT) {
        setError("Could not load the YouTube player.");
        return;
      }
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: loadedId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (cancelled) return;
            const d = Math.floor(playerRef.current?.getDuration() ?? 0);
            setDuration(d);
            setStartS(0);
            setEndS(Math.min(d || MAX_CLIP_SECONDS, 15));
            setReady(true);
          },
          onError: () => !cancelled && setError("This video can't be embedded for preview."),
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [loadedId]);

  // Poll the playhead; auto-pause at the preview end.
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const c = p.getCurrentTime();
      setCurrent(c);
      if (previewEndRef.current != null && c >= previewEndRef.current) {
        p.pauseVideo();
        previewEndRef.current = null;
      }
    }, 250);
    return () => clearInterval(t);
  }, [ready]);

  function load() {
    const id = parseYouTubeId(url);
    if (!id) {
      setError("Enter a valid YouTube URL.");
      return;
    }
    setError(null);
    setLoadedId(id);
  }

  const len = Math.max(0, endS - startS);
  const tooLong = len > MAX_CLIP_SECONDS;
  const validRange = len >= 1 && !tooLong;

  function setStart(v: number) {
    const s = Math.min(Math.max(0, v), Math.max(0, endS - 1));
    setStartS(s);
  }
  function setEnd(v: number) {
    const e = Math.max(Math.min(v, duration || v), startS + 1);
    setEndS(e);
  }

  function preview() {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(startS, true);
    previewEndRef.current = endS;
    p.playVideo();
  }

  async function importClip() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/youtube`, {
        method: "POST",
        body: JSON.stringify({ url, startS, endS, kind: mode }),
      });
      onClose(true);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => onClose(false)}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-sm font-semibold">
            {isAudio ? "Add audio overlay from YouTube" : "Import from YouTube"}
          </h2>
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => onClose(false)}>
            Close
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div>
            <Label>YouTube URL</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                placeholder="https://www.youtube.com/watch?v=…"
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
              />
              <Button variant="ghost" className="shrink-0 px-3 py-2 text-sm" onClick={load}>
                Load
              </Button>
            </div>
          </div>

          {loadedId ? (
            <div className="aspect-video w-full overflow-hidden rounded bg-black">
              <div ref={mountRef} className="h-full w-full" />
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Paste a YouTube link and press Load to scrub and trim a clip.
            </p>
          )}

          {ready ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                <span>Playhead: {fmt(current)}</span>
                <span>Video length: {fmt(duration)}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Start: {fmt(startS)}</Label>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => setStart(Math.floor(playerRef.current?.getCurrentTime() ?? 0))}
                  >
                    Set to playhead
                  </Button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={startS}
                  className="w-full accent-[var(--color-accent)]"
                  onChange={(e) => setStart(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>End: {fmt(endS)}</Label>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => setEnd(Math.ceil(playerRef.current?.getCurrentTime() ?? 0))}
                  >
                    Set to playhead
                  </Button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={endS}
                  className="w-full accent-[var(--color-accent)]"
                  onChange={(e) => setEnd(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-sm ${tooLong ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
                  Clip length: {fmt(len)}
                  {tooLong ? ` (max ${fmt(MAX_CLIP_SECONDS)})` : ""}
                </span>
                <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={preview}>
                  ▶ Preview clip
                </Button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] p-4">
          <Button variant="ghost" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={importClip} disabled={busy || !ready || !validRange}>
            {busy ? "Starting…" : isAudio ? "Add audio →" : "Import clip →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
