"use client";

import { useRef, useState } from "react";
import { TTS_MODELS } from "@/config/models";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { Button, Input, Label, Select, StatusBadge, Textarea } from "@/components/ui";
import { YouTubeImport } from "./YouTubeImport";

export type AudioMode = "TTS_FROM_SCRIPT" | "TTS_VERBATIM" | "UPLOAD_AUDIO" | "NONE";

export interface OverlayView {
  id: string;
  index: number;
  label: string | null;
  sourceUrl: string;
  importStartS: number;
  importEndS: number;
  offsetS: number;
  volume: number;
  included: boolean;
  durationS: number | null;
  status: string;
  error: string | null;
  assetId: string | null;
}

export interface AudioDraft {
  audioMode: AudioMode;
  voScript: string;
  voVerbatim: string;
  voDeliveryNotes: string;
  ttsModel: string;
  ttsVoice: string;
  audioFitMode: string;
  voVolume: number;
  voMuted: boolean;
  musicVolume: number;
  musicDucking: boolean;
  musicMuted: boolean;
  audioOverlays: OverlayView[];
}

export function AudioSection({
  projectId,
  draft,
  voiceover,
  musicAssetId,
  scriptGenStatus,
  readOnly,
  setAudio,
  save,
  refetch,
}: {
  projectId: string;
  draft: AudioDraft;
  voiceover: { status: string; assetId: string | null; durationS: number | null } | null;
  musicAssetId: string | null;
  scriptGenStatus: string | null;
  readOnly: boolean;
  setAudio: (patch: Partial<AudioDraft>) => void;
  save: () => Promise<boolean>;
  refetch: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showYouTube, setShowYouTube] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);
  const generating = scriptGenStatus === "RUNNING";

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

  async function uploadFile(endpoint: string, file: File) {
    setBusy(true);
    setError(null);
    try {
      // Persist draft mix settings first — the upload refetch remounts the editor.
      if (!(await save())) return;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(withBase(endpoint), { method: "POST", body: fd });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "upload failed");
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const uploadAudio = (file: File) => uploadFile(`/api/projects/${projectId}/audio`, file);
  const uploadMusic = (file: File) => uploadFile(`/api/projects/${projectId}/music`, file);

  function setOverlay(id: string, patch: Partial<OverlayView>) {
    setAudio({
      audioOverlays: draft.audioOverlays.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  }

  async function openYouTubeAudio() {
    setBusy(true);
    setError(null);
    try {
      // Persist draft edits first — the import refetch remounts the editor.
      if (await save()) setShowYouTube(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const mode = draft.audioMode;
  const isTts = mode === "TTS_FROM_SCRIPT" || mode === "TTS_VERBATIM";
  // The bed is offered when there's a separate voice/silent track to sit under;
  // an uploaded master (UPLOAD_AUDIO) is already the whole track.
  const showMusic = mode !== "UPLOAD_AUDIO";
  const voDur =
    mode !== "NONE" && voiceover?.status === "READY" ? voiceover.durationS : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">Audio track</h2>
          {voDur != null ? (
            <span className="text-xs text-[var(--color-muted)]">
              voiceover {voDur.toFixed(1)}s
            </span>
          ) : null}
        </div>
        {isTts && !readOnly ? (
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={busy || generating || mode !== "TTS_FROM_SCRIPT"}
            title={mode !== "TTS_FROM_SCRIPT" ? "Switch to 'AI script' to generate" : undefined}
            onClick={() => void run(() => api(`/api/projects/${projectId}/generate-script`, { method: "POST", body: "{}" }))}
          >
            {generating ? "Writing…" : "✨ Write script (AI)"}
          </Button>
        ) : null}
      </div>

      <div>
        <Label>Mode</Label>
        <Select
          value={mode}
          disabled={readOnly}
          onChange={(e) => setAudio({ audioMode: e.target.value as AudioMode })}
        >
          <option value="TTS_FROM_SCRIPT">AI-written script → voiceover</option>
          <option value="TTS_VERBATIM">My verbatim transcript → voiceover</option>
          <option value="UPLOAD_AUDIO">Upload audio (VO take or music)</option>
          <option value="NONE">Silent (no audio)</option>
        </Select>
      </div>

      {mode === "TTS_FROM_SCRIPT" ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label>Voiceover script</Label>
            <span className="text-xs text-[var(--color-muted)]">{draft.voScript.length} chars</span>
          </div>
          <Textarea
            rows={4}
            value={draft.voScript}
            disabled={readOnly}
            placeholder="Generate with AI, or write the narration here."
            onChange={(e) => setAudio({ voScript: e.target.value })}
          />
        </div>
      ) : null}

      {mode === "TTS_VERBATIM" ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label hint="spoken exactly as written">Verbatim transcript</Label>
            <span className="text-xs text-[var(--color-muted)]">{draft.voVerbatim.length} chars</span>
          </div>
          <Textarea
            rows={4}
            value={draft.voVerbatim}
            disabled={readOnly}
            placeholder="Paste the exact words to be spoken."
            onChange={(e) => setAudio({ voVerbatim: e.target.value })}
          />
        </div>
      ) : null}

      {isTts ? (
        <>
          <div>
            <Label hint="pace, emotion, emphasis (sent to the voice model if supported)">
              Delivery notes
            </Label>
            <Textarea
              rows={2}
              value={draft.voDeliveryNotes}
              disabled={readOnly}
              placeholder="e.g. Calm and measured, slow down on the final line."
              onChange={(e) => setAudio({ voDeliveryNotes: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Voice model</Label>
              <Select
                value={draft.ttsModel}
                disabled={readOnly}
                onChange={(e) => setAudio({ ttsModel: e.target.value })}
              >
                {TTS_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label hint="blank = the house narrator; ElevenLabs: a voice id; Grok: ara, eve, rex, sal, leo">Voice</Label>
              <Input
                value={draft.ttsVoice}
                disabled={readOnly}
                placeholder="default"
                onChange={(e) => setAudio({ ttsVoice: e.target.value })}
              />
            </div>
          </div>
        </>
      ) : null}

      {mode === "UPLOAD_AUDIO" ? (
        <div className="space-y-2">
          {voiceover?.assetId ? (
            <div className="flex items-center gap-3">
              <audio src={withBase(`/api/assets/${voiceover.assetId}`)} controls className="w-full" />
              {!readOnly ? (
                <button
                  type="button"
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => void run(() => api(`/api/projects/${projectId}/audio`, { method: "DELETE" }))}
                >
                  remove
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No audio uploaded yet.</p>
          )}
          {!readOnly ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-wav,audio/ogg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAudio(f);
                  e.target.value = "";
                }}
              />
              <Button variant="ghost" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
                {voiceover?.assetId ? "Replace audio" : "Upload audio"}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {mode === "NONE" && !musicAssetId ? (
        <p className="text-sm text-[var(--color-muted)]">
          Silent — the final video will have no audio track.
        </p>
      ) : null}

      {showMusic ? (
        <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <Label hint={isTts ? "plays under the voiceover" : "plays as the audio track"}>
            Music bed (optional)
          </Label>
          {musicAssetId ? (
            <div className="flex items-center gap-3">
              <audio src={withBase(`/api/assets/${musicAssetId}`)} controls className="w-full" />
              {!readOnly ? (
                <button
                  type="button"
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => void run(() => api(`/api/projects/${projectId}/music`, { method: "DELETE" }))}
                >
                  remove
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No music bed.</p>
          )}
          {!readOnly ? (
            <input
              ref={musicRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-wav,audio/ogg"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadMusic(f);
                e.target.value = "";
              }}
            />
          ) : null}
          {!readOnly && !musicAssetId ? (
            <Button variant="ghost" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => musicRef.current?.click()}>
              Upload music
            </Button>
          ) : null}
          {musicAssetId ? (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label>Music volume</Label>
                  <span className="text-xs text-[var(--color-muted)]">
                    {Math.round(draft.musicVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={draft.musicVolume}
                  disabled={readOnly}
                  className="w-full accent-[var(--color-accent)]"
                  onChange={(e) => setAudio({ musicVolume: Number(e.target.value) })}
                />
              </div>
              {isTts ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.musicDucking}
                    disabled={readOnly}
                    className="accent-[var(--color-accent)]"
                    onChange={(e) => setAudio({ musicDucking: e.target.checked })}
                  />
                  Lower music under the voice (ducking)
                </label>
              ) : null}
              {!readOnly ? (
                <Button variant="ghost" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => musicRef.current?.click()}>
                  Replace music
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {mode !== "NONE" ? (
        <div>
          <Label hint="when audio and video lengths differ">Audio fit</Label>
          <Select
            value={draft.audioFitMode}
            disabled={readOnly}
            onChange={(e) => setAudio({ audioFitMode: e.target.value })}
          >
            <option value="PAD_VIDEO">Keep full audio (freeze last frame)</option>
            <option value="TRIM_VO">Fit audio to video length</option>
          </Select>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center justify-between">
          <Label hint="play OVER everything — sound bites, stings, clips">
            Audio overlays
          </Label>
          {!readOnly ? (
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              disabled={busy}
              onClick={() => void openYouTubeAudio()}
            >
              ▶ + YouTube audio
            </Button>
          ) : null}
        </div>

        {draft.audioOverlays.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            None. Grab an audio clip from YouTube to play over the rest of the video.
          </p>
        ) : (
          <div className="space-y-3">
            {draft.audioOverlays.map((o) => (
              <div
                key={o.id}
                className="space-y-2 rounded-lg border border-[var(--color-border)] border-l-4 border-l-[var(--color-accent)] bg-[var(--color-surface)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {o.label?.trim() ? o.label : "YouTube audio"}
                    {o.durationS != null ? (
                      <span className="text-xs font-normal text-[var(--color-muted)]">
                        {" "}
                        · {o.durationS.toFixed(1)}s
                      </span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-2">
                    {o.status !== "READY" ? <StatusBadge status={o.status} /> : null}
                    {!readOnly ? (
                      <button
                        type="button"
                        className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                        onClick={() =>
                          void run(() =>
                            api(`/api/projects/${projectId}/audio-overlays/${o.id}`, {
                              method: "DELETE",
                            }),
                          )
                        }
                      >
                        remove
                      </button>
                    ) : null}
                  </div>
                </div>

                {o.status === "READY" && o.assetId ? (
                  <audio src={withBase(`/api/assets/${o.assetId}`)} controls className="w-full" />
                ) : o.status === "FAILED" ? (
                  <p className="text-xs text-[var(--color-danger)]">
                    {o.error ?? "Download failed"}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-muted)]">Downloading audio…</p>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={o.included}
                    disabled={readOnly}
                    className="accent-[var(--color-accent)]"
                    onChange={(e) => setOverlay(o.id, { included: e.target.checked })}
                  />
                  Include in the final mix
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label>Volume</Label>
                      <span className="text-xs text-[var(--color-muted)]">
                        {Math.round(o.volume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={o.volume}
                      disabled={readOnly}
                      className="w-full accent-[var(--color-accent)]"
                      onChange={(e) => setOverlay(o.id, { volume: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label hint="seconds from the start">Start at</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={o.offsetS}
                      disabled={readOnly}
                      onChange={(e) =>
                        setOverlay(o.id, { offsetS: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showYouTube ? (
        <YouTubeImport
          projectId={projectId}
          mode="audio"
          onClose={async (imported) => {
            setShowYouTube(false);
            if (imported) await refetch();
          }}
        />
      ) : null}

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
