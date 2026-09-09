"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUndoable } from "./useUndoable";
import { frameSize } from "@/config/frame-sizes";
import { api } from "@/lib/api";
import { type Draft, draftCost, seed } from "@/lib/projects/draft";
import type { ProjectSnapshot } from "@/lib/projects/serialize";
import { useExportStore } from "@/stores/exportStore";
import { DEFAULT_PIP } from "@/lib/render/pip";
import { buildRenderSpec, type RenderSpec } from "@/lib/render/spec";
import { useCostStore } from "@/stores/costStore";
import { useStudioWorkspaceStore } from "@/stores/studioWorkspaceStore";
import type { AudioDraft } from "@/components/AudioSection";
import type { SegmentPatch } from "@/components/SegmentCard";
import type { TextOverlayView } from "@/components/TextOverlaySection";
import type { RenderAsset } from "@/components/timeline/ProgramMonitor";
import { usePreviewEngine } from "@/components/timeline/usePreviewEngine";
import { useLeaveGuard } from "./useLeaveGuard";
import { useAudioStudioStore } from "@/stores/audioStudioStore";
import { pollAudioJob } from "@/lib/audio/jobClient";

type MonitorMode = "live" | "rendered";

export interface ProjectEditorContextValue {
  snapshot: ProjectSnapshot;
  isAdmin: boolean;
  userEmail: string;
  readOnly: boolean;

  draft: Draft;
  onSegmentChange: (id: string, patch: SegmentPatch) => void;
  onReorder: (orderedIds: string[]) => void;
  setAudio: (patch: Partial<AudioDraft>) => void;
  setPolish: (patch: Partial<Draft>) => void;
  onTextOverlayChange: (id: string, patch: Partial<TextOverlayView>) => void;
  /** Structural timeline edits: persist the draft, then hit the API + refetch. */
  onSplitSegment: (id: string, atS: number) => Promise<void>;
  onDeleteSegment: (id: string) => Promise<void>;
  /** Insert a library asset as a new clip (V1 append, or V2 overlay at offset);
   *  optionally a subclip via trimStartS/durationS (Source Monitor In/Out). */
  insertMedia: (
    asset: { id: string; isVideo: boolean; isAudio?: boolean },
    opts?: { track?: number; offsetS?: number; trimStartS?: number; durationS?: number },
  ) => Promise<void>;
  /** Drop an Audio Studio workspace track onto the video timeline: register it
   *  as an Asset, then place it as an audio-only clip at offsetS. */
  insertAudioFromStudio: (
    payload: { relPath: string; trimStartS?: number; durationS?: number },
    offsetS: number,
    track?: number,
  ) => Promise<void>;

  save: () => Promise<boolean>;
  saving: boolean;
  saved: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  previewSpec: RenderSpec;
  dirty: boolean;
  renderAsset: RenderAsset | null;

  engine: ReturnType<typeof usePreviewEngine>;
  monitorMode: MonitorMode;
  setMonitorMode: (m: MonitorMode) => void;
  effectiveMode: MonitorMode;

  renderBlocker: () => string | null;
  openRender: () => Promise<void>;
  showCost: boolean;
  setShowCost: (b: boolean) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** The clip selected in the Timeline (drives the Effect Controls panel). */
  selectedSegmentId: string | null;
  setSelectedSegmentId: (id: string | null) => void;

  /** Source video loaded into the Video Edit panel (set by drag / Media Bucket
   *  right-click). The panel has no picker of its own. */
  videoEditSourceId: string | null;
  /** Load a video into the Video Edit panel, opening/focusing it if needed. */
  openInVideoEdit: (assetId: string) => void;
  /** Unlink a video clip's audio into a separate audio-only clip (mutes the clip). */
  onUnlinkAudio: (videoSegmentId: string) => Promise<void>;

  /** Leave the editor through the unsaved/empty-project guard: runs `go` now if
   *  the project is saved + has content, else prompts to name+save or discard. */
  guardedLeave: (go: () => void) => void;
}

const ProjectEditorContext = createContext<ProjectEditorContextValue | null>(null);

export function useProjectEditor(): ProjectEditorContextValue {
  const ctx = useContext(ProjectEditorContext);
  if (!ctx) throw new Error("useProjectEditor must be used within a ProjectEditorProvider");
  return ctx;
}

/**
 * Holds the open project's entire edit state (formerly `TrackEditor`) and exposes
 * it to every Studio panel via {@link useProjectEditor}. The preview {@link usePreviewEngine}
 * lives here once so the Monitor and Timeline panels share one playhead/clock.
 * Keyed on the snapshot's updatedAt by the caller, so a fresh server state remounts
 * this and re-seeds the draft.
 */
export function ProjectEditorProvider({
  snapshot,
  refetch,
  isAdmin,
  userEmail,
  children,
}: {
  snapshot: ProjectSnapshot;
  refetch: () => Promise<void>;
  isAdmin: boolean;
  userEmail: string;
  children: ReactNode;
}) {
  const [draft, setDraft, undoCtl] = useUndoable<Draft>(() => seed(snapshot));
  const { undo, redo, canUndo, canRedo } = undoCtl;
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [videoEditSourceId, setVideoEditSourceId] = useState<string | null>(null);

  // Generation in flight → lock editing (edits were saved before generating).
  const readOnly =
    snapshot.visualGenStatus === "RUNNING" || snapshot.scriptGenStatus === "RUNNING";

  const cost = useMemo(() => draftCost(draft, snapshot.videoModel), [draft, snapshot.videoModel]);
  const isDone = snapshot.status === "DONE";

  // Surface the running cost in the global header (cleared when we leave).
  const setHeaderCost = useCostStore((s) => s.setCents);
  useEffect(() => {
    setHeaderCost(cost.totalCents);
  }, [cost.totalCents, setHeaderCost]);
  useEffect(() => () => setHeaderCost(null), [setHeaderCost]);

  // Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) redo. The form fields are
  // controlled by the draft, so app-level undo covers their values too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const previewSpec = useMemo(() => {
    const dims = frameSize(snapshot);
    return buildRenderSpec({
      segments: draft.segments,
      width: dims.w,
      height: dims.h,
      transition: draft.transition,
      transitionMs: draft.transitionMs,
      colorLook: draft.colorLook,
      fillMode: draft.fillMode,
      vignette: draft.vignette,
      grain: draft.grain,
      audioFitMode: draft.audioFitMode,
      texts: draft.textOverlays,
      watermark: {
        assetId: snapshot.watermarkAssetId,
        position: draft.watermarkPosition,
        scale: draft.watermarkScale,
        opacity: draft.watermarkOpacity,
        margin: draft.watermarkMargin,
      },
      voAssetId: draft.audioMode !== "NONE" ? (snapshot.voiceover?.assetId ?? null) : null,
      voVolume: draft.voMuted ? 0 : draft.voVolume,
      musicAssetId: snapshot.musicAssetId,
      safeArea: snapshot.safeArea,
      musicVolume: draft.musicMuted ? 0 : draft.musicVolume,
      voDurationS: snapshot.voiceover?.durationS ?? null,
      captions: {
        enabled: draft.captionsEnabled,
        text: draft.audioMode === "TTS_VERBATIM" ? draft.voVerbatim : draft.voScript || draft.voVerbatim,
        spanS:
          draft.audioMode !== "NONE" && (snapshot.voiceover?.durationS ?? 0) > 0
            ? (snapshot.voiceover!.durationS as number)
            : draft.segments.reduce((a, s) => a + s.durationS, 0),
        position: draft.captionPosition,
        sizePct: draft.captionSizePct,
      },
    });
  }, [draft, snapshot]);

  const renderAsset: RenderAsset | null =
    isDone && snapshot.finalRender?.assetId
      ? { assetId: snapshot.finalRender.assetId, durationS: snapshot.finalRender.durationS }
      : null;
  const [initialJson] = useState(() => JSON.stringify(draft));
  const dirty = useMemo(() => JSON.stringify(draft) !== initialJson, [draft, initialJson]);
  // Baseline for "unsaved since last save" (distinct from `dirty`, which is
  // "edited since load"). Resets when a save succeeds → drives the leave guard.
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const unsaved = useMemo(
    () => (savedJson === null ? dirty : JSON.stringify(draft) !== savedJson),
    [draft, savedJson, dirty],
  );

  // Always default to Live (the editing surface); the user can switch to the
  // rendered MP4 from the monitor's toggle. Still auto-flips to Live on the dirty
  // transition (adjust-state-during-render — no set-state-in-effect).
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("live");
  const [wasDirty, setWasDirty] = useState(dirty);
  if (dirty !== wasDirty) {
    setWasDirty(dirty);
    if (dirty) setMonitorMode("live");
  }
  const effectiveMode: MonitorMode = renderAsset ? monitorMode : "live";

  // The preview engine only runs when a Monitor panel is open AND in Live mode —
  // closing/minimizing the Monitor pauses all decode work.
  const monitorVisible = useStudioWorkspaceStore((s) =>
    s.windows.some((w) => w.panelType === "monitor" && !w.isMinimized),
  );
  const engine = usePreviewEngine(previewSpec, effectiveMode === "live" && monitorVisible);

  // Spacebar plays/pauses the preview (Premiere-style) — unless you're typing in
  // a field or focused on a control, where Space has its own meaning.
  const togglePlay = engine.toggle;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || el?.isContentEditable) {
        return;
      }
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  async function save(): Promise<boolean> {
    if (readOnly) return true;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/projects/${snapshot.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          audioMode: draft.audioMode,
          voScript: draft.voScript.trim() ? draft.voScript : null,
          voVerbatim: draft.voVerbatim.trim() ? draft.voVerbatim : null,
          voDeliveryNotes: draft.voDeliveryNotes.trim() ? draft.voDeliveryNotes : null,
          ttsModel: draft.ttsModel,
          ttsVoice: draft.ttsVoice.trim() ? draft.ttsVoice : null,
          audioFitMode: draft.audioFitMode,
          voVolume: draft.voVolume,
          voMuted: draft.voMuted,
          musicVolume: draft.musicVolume,
          musicDucking: draft.musicDucking,
          musicMuted: draft.musicMuted,
          audioNormalize: draft.audioNormalize,
          colorLook: draft.colorLook,
          transition: draft.transition,
          transitionMs: draft.transitionMs,
          fillMode: draft.fillMode,
          vignette: draft.vignette,
          grain: draft.grain,
          audioFadeInS: draft.audioFadeInS,
          audioFadeOutS: draft.audioFadeOutS,
          watermarkPosition: draft.watermarkPosition,
          watermarkScale: draft.watermarkScale,
          watermarkOpacity: draft.watermarkOpacity,
          watermarkMargin: draft.watermarkMargin,
          captionsEnabled: draft.captionsEnabled,
          captionPosition: draft.captionPosition,
          captionSizePct: draft.captionSizePct,
          captionStyle: draft.captionStyle,
          textOverlays: draft.textOverlays.map((t) => ({
            id: t.id,
            text: t.text,
            position: t.position,
            sizePct: t.sizePct,
            color: t.color,
            boxEnabled: t.boxEnabled,
            boxColor: t.boxColor,
            boxOpacity: t.boxOpacity,
            marginPx: t.marginPx,
            startS: t.startS,
            endS: t.endS,
            animation: t.animation,
          })),
          audioOverlays: draft.audioOverlays.map((o) => ({
            id: o.id,
            volume: o.volume,
            offsetS: o.offsetS,
            included: o.included,
            label: o.label,
          })),
          segments: draft.segments.map((s) => ({
            id: s.id,
            prompt: s.prompt,
            videoModel: s.videoModel,
            speed: s.speed,
            durationS: s.durationS,
            trimStartS: s.trimStartS,
            imageMotion: s.imageMotion,
            muted: s.muted,
            brightness: s.brightness,
            contrast: s.contrast,
            saturation: s.saturation,
            transform: s.transform,
            effects: s.effects,
            track: s.track,
            offsetS: s.offsetS,
            audioOnly: s.audioOnly,
            pip: s.pip,
            refImageId: s.refImageId,
            refRole: s.refRole,
          })),
        }),
      });
      setSaved(true);
      setSavedJson(JSON.stringify(draft)); // clear the leave-guard "unsaved" baseline
      setTimeout(() => setSaved(false), 1500);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function onSegmentChange(id: string, patch: SegmentPatch) {
    setDraft((d) => ({
      ...d,
      segments: d.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function setAudio(patch: Partial<AudioDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function setPolish(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function onTextOverlayChange(id: string, patch: Partial<TextOverlayView>) {
    setDraft((d) => ({
      ...d,
      textOverlays: d.textOverlays.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function onReorder(orderedIds: string[]) {
    setDraft((d) => {
      const byId = new Map(d.segments.map((s) => [s.id, s]));
      const next = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Draft["segments"];
      return next.length === d.segments.length ? { ...d, segments: next } : d;
    });
  }

  // Structural edits change the segment set on the server, so save the draft
  // first (don't lose unsaved trims), then mutate + refetch (which re-seeds).
  async function onSplitSegment(segId: string, atS: number) {
    if (readOnly) return;
    await save();
    await api(`/api/projects/${snapshot.id}/segments/${segId}/split`, {
      method: "POST",
      body: JSON.stringify({ atS }),
    });
    await refetch();
  }

  async function onDeleteSegment(segId: string) {
    if (readOnly) return;
    await save();
    await api(`/api/projects/${snapshot.id}/segments/${segId}`, { method: "DELETE" });
    await refetch();
  }

  async function insertMedia(
    asset: { id: string; isVideo: boolean; isAudio?: boolean },
    opts?: { track?: number; offsetS?: number; trimStartS?: number; durationS?: number },
  ) {
    if (readOnly) return;
    await save();
    // Audio → an audio-only clip on an audio track (positioned by offsetS).
    if (asset.isAudio) {
      const body: Record<string, unknown> = {
        source: "UPLOAD_VIDEO",
        sourceAssetId: asset.id,
        audioOnly: true,
        track: Math.max(0, opts?.track ?? 0),
        offsetS: Math.max(0, Math.round((opts?.offsetS ?? 0) * 10) / 10),
      };
      if (opts?.trimStartS != null) body.trimStartS = opts.trimStartS;
      if (opts?.durationS != null) body.durationS = opts.durationS;
      await api(`/api/projects/${snapshot.id}/segments`, { method: "POST", body: JSON.stringify(body) });
      await refetch();
      return;
    }
    const body: Record<string, unknown> = asset.isVideo
      ? { source: "UPLOAD_VIDEO", sourceAssetId: asset.id }
      : { source: "UPLOAD_IMAGE_STILL", sourceAssetId: asset.id, durationS: 5 };
    if (opts?.trimStartS != null) body.trimStartS = opts.trimStartS;
    if (opts?.durationS != null) body.durationS = opts.durationS;
    if (opts?.track && opts.track >= 1) {
      // Any track >= 1 is a positioned overlay layer (V2, V3, …).
      body.track = opts.track;
      body.offsetS = Math.max(0, Math.round((opts.offsetS ?? 0) * 10) / 10);
      body.pip = DEFAULT_PIP;
    }
    await api(`/api/projects/${snapshot.id}/segments`, { method: "POST", body: JSON.stringify(body) });
    await refetch();
  }

  async function insertAudioFromStudio(
    payload: { relPath: string; trimStartS?: number; durationS?: number },
    offsetS: number,
    track = 0,
  ) {
    if (readOnly) return;
    const { id } = await api<{ id: string }>("/api/audio/to-asset", {
      method: "POST",
      body: JSON.stringify({ projectId: snapshot.id, relPath: payload.relPath }),
    });
    await insertMedia(
      { id, isVideo: false, isAudio: true },
      { offsetS, track, trimStartS: payload.trimStartS, durationS: payload.durationS },
    );
  }

  function renderBlocker(): string | null {
    if (draft.segments.filter((s) => (s.track ?? 0) === 0 && !s.audioOnly && !s.library).length === 0)
      return "Add at least one clip to the main (V1) track";
    if (draft.segments.some((s) => s.importUrl && !s.sourceAssetId))
      return "A YouTube import is still in progress or failed";
    return null;
  }

  async function openRender() {
    // "Export" — save, then open the floating export window. It's controlled via a
    // module store + rendered above the keyed remount (ProjectWorkspace) so the
    // render it fires (which bumps updatedAt → remounts StudioRoot) can't kill it.
    if (await save()) useExportStore.getState().open(snapshot.id);
  }

  // Send a video to the Video Edit panel, opening (or focusing) it. The panel
  // itself has no picker — media arrives only via drag or this call.
  function openInVideoEdit(assetId: string) {
    setVideoEditSourceId(assetId);
    const store = useStudioWorkspaceStore.getState();
    const existing = store.windows.find((w) => w.panelType === "video-edit");
    if (existing) {
      if (existing.isMinimized) store.restoreWindow(existing.id);
      store.bringToFront(existing.id);
    } else {
      store.addWindow("video-edit", "Video Edit");
    }
  }

  // Unlink a video clip's audio: mute the clip and drop a separate audio-only
  // clip on the audio track at the same timeline position (Premiere "Unlink").
  async function onUnlinkAudio(videoSegmentId: string) {
    if (readOnly) return;
    const seg = draft.segments.find((s) => s.id === videoSegmentId);
    if (!seg || !seg.sourceAssetId || seg.audioOnly) return;
    // The clip's start on the timeline: V1 is contiguous, V2/audio use offsetS.
    let start = seg.offsetS ?? 0;
    if ((seg.track ?? 0) === 0) {
      start = 0;
      for (const s of draft.segments.filter((x) => (x.track ?? 0) === 0 && !x.audioOnly)) {
        if (s.id === videoSegmentId) break;
        start += s.durationS;
      }
    }
    await save(); // persist any pending edits before the structural change
    // Mute the source clip (its audio now lives on the audio track).
    await api(`/api/projects/${snapshot.id}`, {
      method: "PATCH",
      body: JSON.stringify({ segments: [{ id: videoSegmentId, muted: true }] }),
    });
    // Create the audio-only clip at the same position/trim.
    await api(`/api/projects/${snapshot.id}/segments`, {
      method: "POST",
      body: JSON.stringify({
        source: "UPLOAD_VIDEO",
        sourceAssetId: seg.sourceAssetId,
        audioOnly: true,
        trimStartS: seg.trimStartS ?? 0,
        durationS: seg.durationS,
        offsetS: Math.round(start * 10) / 10,
        muted: false,
      }),
    });
    await refetch();
  }

  // Guard leaving a throwaway project: nothing on the timeline (no clips/audio),
  // or unsaved edits. A saved project with content leaves freely. In the Audio
  // Studio the multitrack arrangement is session-only, so we also guard when it
  // has tracks — and "save" there means bounce a master + attach it (persist).
  const section = useStudioWorkspaceStore((s) => s.section);
  const audioTrackCount = useAudioStudioStore((s) => s.tracks.length);
  const inAudio = section === "audio";
  const isEmpty = draft.segments.length === 0 && draft.audioOverlays.length === 0;
  const hasAudioWork = inAudio && audioTrackCount > 0;

  // Bounce the Audio Studio arrangement to a master file and attach it to the
  // project as a persisted audio segment (the session arrangement itself isn't
  // saved — this saves the rendered result). Then persist project settings.
  async function mixdownAndSave(name: string): Promise<boolean> {
    if (name && name !== snapshot.title) {
      await api(`/api/projects/${snapshot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: name }),
      });
    }
    const tracks = useAudioStudioStore.getState().tracks;
    if (tracks.length > 0) {
      const { jobId } = await api<{ jobId: string }>("/api/audio/mix", {
        method: "POST",
        body: JSON.stringify({
          projectId: snapshot.id,
          format: "wav",
          name: name || "Mixdown",
          tracks: tracks.map((t) => ({
            relPath: t.relPath,
            volume: t.volume,
            muted: t.muted,
            solo: t.solo,
            offsetS: t.offsetS,
            trimStartS: t.trimStartS,
            durationS: t.durationS,
          })),
        }),
      });
      const job = await pollAudioJob(jobId, () => {});
      const r = job.result as { relPath: string; durationS: number };
      // Register the master as a project Asset + drop it as an audio segment.
      const { id: assetId } = await api<{ id: string }>("/api/audio/to-asset", {
        method: "POST",
        body: JSON.stringify({ projectId: snapshot.id, relPath: r.relPath }),
      });
      await api(`/api/projects/${snapshot.id}/segments`, {
        method: "POST",
        body: JSON.stringify({
          source: "UPLOAD_VIDEO",
          sourceAssetId: assetId,
          audioOnly: true,
          track: 0,
          offsetS: 0,
          durationS: r.durationS,
        }),
      });
      // Persist the editable session so the multitrack reopens for re-editing.
      await api(`/api/projects/${snapshot.id}/audio-session`, {
        method: "PUT",
        body: JSON.stringify({
          tracks: tracks.map((t) => ({
            name: t.name,
            relPath: t.relPath,
            url: t.url,
            durationS: t.durationS,
            sourceDurationS: t.sourceDurationS,
            trimStartS: t.trimStartS,
            kind: t.kind,
            color: t.color,
            muted: t.muted,
            solo: t.solo,
            volume: t.volume,
            offsetS: t.offsetS,
            bpm: t.bpm ?? null,
            beats: t.beats,
          })),
        }),
      });
    }
    return await save();
  }

  const { guardedLeave, dialog: leaveDialog } = useLeaveGuard({
    shouldGuard: isEmpty || unsaved || hasAudioWork,
    projectId: snapshot.id,
    initialName: snapshot.title,
    saveLabel: hasAudioWork ? "Mix down & Save" : "Save",
    busyLabel: hasAudioWork ? "Mixing down…" : "Saving…",
    note: hasAudioWork
      ? "Mix the multitrack down to a master and save it to the project, or discard. (The editable arrangement is session-only.)"
      : undefined,
    onSave: async (name) => {
      if (hasAudioWork) return await mixdownAndSave(name);
      if (name && name !== snapshot.title) {
        await api(`/api/projects/${snapshot.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: name }),
        });
      }
      return await save();
    },
  });

  const value: ProjectEditorContextValue = {
    snapshot,
    isAdmin,
    userEmail,
    readOnly,
    draft,
    onSegmentChange,
    onReorder,
    setAudio,
    setPolish,
    onTextOverlayChange,
    onSplitSegment,
    onDeleteSegment,
    insertMedia,
    insertAudioFromStudio,
    save,
    saving,
    saved,
    error,
    refetch,
    previewSpec,
    dirty,
    renderAsset,
    engine,
    monitorMode,
    setMonitorMode,
    effectiveMode,
    renderBlocker,
    openRender,
    showCost,
    setShowCost,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedSegmentId,
    setSelectedSegmentId,
    videoEditSourceId,
    openInVideoEdit,
    onUnlinkAudio,
    guardedLeave,
  };

  return (
    <ProjectEditorContext.Provider value={value}>
      {children}
      {leaveDialog}
    </ProjectEditorContext.Provider>
  );
}
