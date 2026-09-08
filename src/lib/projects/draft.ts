import type { ProjectSnapshot } from "@/lib/projects/serialize";
import { estimateCost } from "@/lib/cost/estimate";
import type { AudioDraft, OverlayView } from "@/components/AudioSection";
import type { SegmentView } from "@/components/SegmentCard";
import type { TextOverlayView } from "@/components/TextOverlaySection";

/** The editable, in-memory state of a project (the "draft"). Seeded from the
 *  server snapshot; only persisted on an explicit save/render. */
export interface Draft extends AudioDraft {
  segments: SegmentView[];
  transition: string;
  transitionMs: number;
  colorLook: string;
  audioNormalize: boolean;
  fillMode: string;
  vignette: boolean;
  grain: number;
  audioFadeInS: number;
  audioFadeOutS: number;
  watermarkPosition: string;
  watermarkScale: number;
  watermarkOpacity: number;
  watermarkMargin: number;
  captionsEnabled: boolean;
  captionPosition: string;
  captionSizePct: number;
  captionStyle: string;
  textOverlays: TextOverlayView[];
}

// Only AI work is billed (matches serialize.ts): AI/driver shots + TTS chars.
export const AI_SOURCES = new Set(["AI_GENERATED", "UPLOAD_IMAGE_DRIVER"]);

export function draftCost(draft: Draft, projectVideoModel: string) {
  const shots = draft.segments
    .filter((s) => AI_SOURCES.has(s.source))
    .map((s) => ({ model: s.videoModel ?? projectVideoModel, durationS: s.durationS }));
  const ttsChars =
    draft.audioMode === "TTS_FROM_SCRIPT"
      ? draft.voScript.length
      : draft.audioMode === "TTS_VERBATIM"
        ? draft.voVerbatim.length
        : 0;
  return estimateCost({ ttsModel: draft.ttsModel, shots, voScriptChars: ttsChars });
}

export function seed(s: ProjectSnapshot): Draft {
  return {
    audioMode: s.audioMode as AudioDraft["audioMode"],
    voScript: s.voScript ?? "",
    voVerbatim: s.voVerbatim ?? "",
    voDeliveryNotes: s.voDeliveryNotes ?? "",
    ttsModel: s.ttsModel,
    ttsVoice: s.ttsVoice ?? "",
    audioFitMode: s.audioFitMode,
    voVolume: s.voVolume,
    voMuted: s.voMuted,
    musicVolume: s.musicVolume,
    musicDucking: s.musicDucking,
    musicMuted: s.musicMuted,
    audioOverlays: s.audioOverlays as OverlayView[],
    transition: s.transition,
    transitionMs: s.transitionMs,
    colorLook: s.colorLook,
    audioNormalize: s.audioNormalize,
    fillMode: s.fillMode,
    vignette: s.vignette,
    grain: s.grain,
    audioFadeInS: s.audioFadeInS,
    audioFadeOutS: s.audioFadeOutS,
    watermarkPosition: s.watermarkPosition,
    watermarkScale: s.watermarkScale,
    watermarkOpacity: s.watermarkOpacity,
    watermarkMargin: s.watermarkMargin,
    captionsEnabled: s.captionsEnabled,
    captionPosition: s.captionPosition,
    captionSizePct: s.captionSizePct,
    captionStyle: s.captionStyle,
    textOverlays: s.textOverlays as TextOverlayView[],
    segments: s.segments as SegmentView[],
  };
}
