import { z } from "zod";
import { CAPS } from "@/config/models";

export const aspectRatioEnum = z.enum(["R16_9", "R9_16", "R1_1"]);
export const resolutionEnum = z.enum(["R480P", "R720P", "R1080P"]);
export const audioFitEnum = z.enum(["PAD_VIDEO", "TRIM_VO"]);
export const audioModeEnum = z.enum([
  "TTS_FROM_SCRIPT",
  "TTS_VERBATIM",
  "UPLOAD_AUDIO",
  "NONE",
]);
export const refRoleEnum = z.enum(["FIRST_FRAME", "LAST_FRAME", "STYLE"]);
export const imageMotionEnum = z.enum([
  "NONE",
  "ZOOM_IN",
  "ZOOM_OUT",
  "PAN_LEFT",
  "PAN_RIGHT",
  "PAN_UP",
  "PAN_DOWN",
  "SUBTLE_ZOOM_IN",
  "SUBTLE_ZOOM_OUT",
]);
export const colorLookEnum = z.enum([
  "NONE",
  "WARM",
  "COOL",
  "BW",
  "VINTAGE",
  "PUNCH",
  "TEAL_ORANGE",
  "NOIR",
  "CAMPAIGN",
  "BLEACH",
]);
export const transitionEnum = z.enum([
  "NONE",
  "CROSSFADE",
  "DISSOLVE",
  "FADE_BLACK",
  "WIPE",
  "SLIDE",
]);
export const fillModeEnum = z.enum(["LETTERBOX", "BLUR_FILL"]);
export const overlayPositionEnum = z.enum([
  "TOP_LEFT",
  "TOP_CENTER",
  "TOP_RIGHT",
  "MIDDLE_LEFT",
  "CENTER",
  "MIDDLE_RIGHT",
  "BOTTOM_LEFT",
  "BOTTOM_CENTER",
  "BOTTOM_RIGHT",
]);
export const textAnimationEnum = z.enum(["NONE", "FADE"]);
const hexColor = z.string().regex(/^#?[0-9a-fA-F]{6}$/, "must be a #RRGGBB hex color");
export const segmentSourceEnum = z.enum([
  "AI_GENERATED",
  "UPLOAD_VIDEO",
  "UPLOAD_IMAGE_STILL",
  "UPLOAD_IMAGE_DRIVER",
]);

// Keyframed Motion (Effect Controls): scale/posX/posY tracks of {t (0..1), v}.
const keyframeSchema = z.object({ t: z.number().min(0).max(1), v: z.number().min(-4).max(4) });
const clipTransformSchema = z.object({
  scale: z.array(keyframeSchema).max(40),
  posX: z.array(keyframeSchema).max(40),
  posY: z.array(keyframeSchema).max(40),
});

// Multi-track: V2 overlay (PiP) placement.
const pipSchema = z.object({
  scale: z.number().min(0.05).max(1),
  posX: z.number().min(0).max(1),
  posY: z.number().min(0).max(1),
  opacity: z.number().min(0).max(1),
});

// Loose duration bound: uploaded video segments can be much longer than an AI
// shot. AI shot durations are kept within CAPS by the LLM + the add-segment UI.
// Float (0.1s precision) so timeline trims can be fine-grained.
const segmentDurationS = z.number().min(0.1).max(600);

export const createProjectSchema = z.object({
  title: z.string().min(1).max(120),
  // Brief is optional — AI generation is opt-in per track.
  goal: z.string().max(2000).optional(),
  subject: z.string().max(500).optional(),
  tone: z.string().max(200).optional(),
  targetLengthS: z.number().int().min(5).max(CAPS.maxTotalDurationS),
  aspectRatio: aspectRatioEnum,
  resolution: resolutionEnum,
  shotCount: z.number().int().min(CAPS.minShots).max(CAPS.maxShots),
  audioMode: audioModeEnum.optional(),
  llmModel: z.string().min(1).max(120),
  videoModel: z.string().min(1).max(120),
  ttsModel: z.string().min(1).max(120),
  ttsVoice: z.string().max(120).optional(),
  audioFitMode: audioFitEnum.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const patchProjectSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  // brief
  goal: z.string().max(2000).nullable().optional(),
  subject: z.string().max(500).nullable().optional(),
  tone: z.string().max(200).nullable().optional(),
  // visual track
  concept: z.string().max(20_000).nullable().optional(),
  // storyboard style anchor
  stylePrompt: z.string().max(2000).nullable().optional(),
  styleAnchorAssetId: z.string().nullable().optional(),
  styleStrength: z.number().min(0).max(1).optional(),
  // audio track
  audioMode: audioModeEnum.optional(),
  scriptFull: z.string().max(40_000).nullable().optional(),
  voScript: z.string().max(20_000).nullable().optional(),
  voVerbatim: z.string().max(20_000).nullable().optional(),
  voDeliveryNotes: z.string().max(2_000).nullable().optional(),
  // audio mixer: voiceover gain + per-track mutes
  voVolume: z.number().min(0).max(2).optional(),
  voMuted: z.boolean().optional(),
  musicMuted: z.boolean().optional(),
  // music bed mix settings (the file is uploaded via /music; these tune the mix)
  musicVolume: z.number().min(0).max(1).optional(),
  musicDucking: z.boolean().optional(),
  // production polish
  audioNormalize: z.boolean().optional(),
  colorLook: colorLookEnum.optional(),
  transition: transitionEnum.optional(),
  transitionMs: z.number().int().min(0).max(3000).optional(),
  fillMode: fillModeEnum.optional(),
  vignette: z.boolean().optional(),
  grain: z.number().int().min(0).max(100).optional(),
  audioFadeInS: z.number().min(0).max(10).optional(),
  audioFadeOutS: z.number().min(0).max(10).optional(),
  // burned-in captions from the voiceover script
  captionsEnabled: z.boolean().optional(),
  captionPosition: overlayPositionEnum.optional(),
  captionSizePct: z.number().int().min(1).max(40).optional(),
  // watermark mix settings (the image is uploaded via /watermark)
  watermarkPosition: overlayPositionEnum.optional(),
  watermarkScale: z.number().min(0.02).max(1).optional(),
  watermarkOpacity: z.number().min(0).max(1).optional(),
  watermarkMargin: z.number().int().min(0).max(400).optional(),
  // models / output
  videoModel: z.string().max(120).optional(),
  ttsModel: z.string().max(120).optional(),
  imageModel: z.string().max(120).optional(),
  ttsVoice: z.string().max(120).nullable().optional(),
  audioFitMode: audioFitEnum.optional(),
  // bulk segment field edits (add/remove/reorder go through dedicated routes)
  segments: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().max(2000).optional(),
        videoModel: z.string().max(120).nullable().optional(),
        speed: z.number().min(0.5).max(2).optional(),
        durationS: segmentDurationS.optional(),
        trimStartS: z.number().min(0).max(12 * 60 * 60).optional(),
        imageMotion: imageMotionEnum.optional(),
        muted: z.boolean().optional(),
        brightness: z.number().min(-0.3).max(0.3).optional(),
        contrast: z.number().min(0.5).max(1.5).optional(),
        saturation: z.number().min(0).max(2).optional(),
        transform: clipTransformSchema.nullable().optional(),
        effects: z
          .array(
            z.object({
              id: z.string().max(64).optional(),
              kind: z.string().max(40),
              enabled: z.boolean().optional(),
              params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
            }),
          )
          .max(24)
          .nullable()
          .optional(),
        track: z.number().int().min(0).max(1).optional(),
        offsetS: z.number().min(0).max(12 * 60 * 60).optional(),
        pip: pipSchema.nullable().optional(),
        audioOnly: z.boolean().optional(),
        refImageId: z.string().nullable().optional(),
        refRole: refRoleEnum.nullable().optional(),
      }),
    )
    .max(CAPS.maxSegments)
    .optional(),
  // text overlays — per-item edits (add/remove go through their own routes)
  textOverlays: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().max(500).optional(),
        position: overlayPositionEnum.optional(),
        sizePct: z.number().int().min(1).max(40).optional(),
        color: hexColor.optional(),
        boxEnabled: z.boolean().optional(),
        boxColor: hexColor.optional(),
        boxOpacity: z.number().min(0).max(1).optional(),
        marginPx: z.number().int().min(0).max(600).optional(),
        startS: z.number().min(0).max(3600).optional(),
        endS: z.number().min(0).max(3600).nullable().optional(),
        animation: textAnimationEnum.optional(),
      }),
    )
    .max(CAPS.maxTextOverlays)
    .optional(),
  // audio overlays — per-item mix settings (import/remove go through their own routes)
  audioOverlays: z
    .array(
      z.object({
        id: z.string().min(1),
        volume: z.number().min(0).max(1).optional(),
        offsetS: z.number().min(0).max(3600).optional(),
        included: z.boolean().optional(),
        label: z.string().max(200).nullable().optional(),
      }),
    )
    .max(CAPS.maxAudioOverlays)
    .optional(),
});
export type PatchProjectInput = z.infer<typeof patchProjectSchema>;

export const addSegmentSchema = z.object({
  source: segmentSourceEnum,
  prompt: z.string().max(2000).optional(),
  durationS: segmentDurationS.optional(),
  // subclip in-point (Source Monitor): source seconds skipped from the start
  trimStartS: z.number().min(0).max(12 * 60 * 60).optional(),
  imageMotion: imageMotionEnum.optional(),
  sourceAssetId: z.string().optional(),
  refImageId: z.string().nullable().optional(),
  refRole: refRoleEnum.nullable().optional(),
  // multi-track placement (e.g. dropping media onto the V2 overlay lane)
  track: z.number().int().min(0).max(1).optional(),
  offsetS: z.number().min(0).max(12 * 60 * 60).optional(),
  pip: pipSchema.nullable().optional(),
  // include the clip's own audio in the final mix (video clips)
  muted: z.boolean().optional(),
  // audio-only clip (unlinked clip audio), positioned by offsetS
  audioOnly: z.boolean().optional(),
});
export type AddSegmentInput = z.infer<typeof addSegmentSchema>;

// Simplified one-shot AI video generation (the Video Generator panel).
export const generateClipSchema = z.object({
  videoModel: z.string().min(1).max(120),
  prompt: z.string().min(1).max(2000),
  durationS: z.number().int().min(1).max(60),
  refAssetId: z.string().nullable().optional(),
});

// Simplified voiceover generation (the Voiceover panel) → TTS audio clip.
export const generateVoiceoverSchema = z.object({
  ttsModel: z.string().min(1).max(120),
  voice: z.string().min(1).max(60),
  text: z.string().min(1).max(5000),
  instructions: z.string().max(500).optional(),
});

export const reorderSegmentsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(CAPS.maxSegments),
});

// Blade: split a clip at a local on-screen offset into two contiguous segments.
export const splitSegmentSchema = z.object({
  atS: z.number().min(0.1).max(12 * 60 * 60),
});

export const importYoutubeSchema = z.object({
  url: z.string().min(1).max(500),
  startS: z.number().min(0).max(12 * 60 * 60),
  endS: z.number().min(0).max(12 * 60 * 60),
  // "video" → a visual segment; "audio" → an audio overlay mixed over the final.
  kind: z.enum(["video", "audio"]).default("video"),
});
export type ImportYoutubeInput = z.infer<typeof importYoutubeSchema>;

export const recutClipSchema = z.object({
  startS: z.number().min(0).max(12 * 60 * 60),
  endS: z.number().min(0).max(12 * 60 * 60),
});
export type RecutClipInput = z.infer<typeof recutClipSchema>;

export const generateImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
  styleStrength: z.number().min(0).max(1).optional(),
  // owned image assets used as style / character anchors for continuity
  styleRefAssetId: z.string().optional(),
  characterRefAssetId: z.string().optional(),
  // optionally attach the keyframe to a segment as its reference image, OR to a
  // persistent story element / variant as its identity image
  targetSegmentId: z.string().optional(),
  targetRole: refRoleEnum.optional(),
  targetElementId: z.string().optional(),
  targetVariantId: z.string().optional(),
  // edit-in-place: condition ONLY on this asset (the current keyframe) + prompt-
  // as-instruction, ignoring element/style refs (Kontext/Nano Banana refine).
  editFromAssetId: z.string().optional(),
});
export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export const storyElementKindEnum = z.enum(["SCENE", "CHARACTER", "OBJECT"]);

export const addShotElementSchema = z.object({
  elementId: z.string().min(1),
  variantId: z.string().nullable().optional(),
});
export const patchShotElementSchema = z.object({
  variantId: z.string().nullable().optional(),
});

export const addElementSchema = z.object({
  kind: storyElementKindEnum,
  name: z.string().min(1).max(120),
  prompt: z.string().max(2000).optional(),
});
export type AddElementInput = z.infer<typeof addElementSchema>;

export const patchElementSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  prompt: z.string().max(2000).optional(),
});

export const addVariantSchema = z.object({
  label: z.string().min(1).max(120),
  prompt: z.string().max(2000).optional(),
});

export const patchVariantSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  prompt: z.string().max(2000).optional(),
});

export const addTextOverlaySchema = z.object({
  text: z.string().min(1).max(500),
  position: overlayPositionEnum.optional(),
  sizePct: z.number().int().min(1).max(40).optional(),
  color: hexColor.optional(),
  boxEnabled: z.boolean().optional(),
  boxColor: hexColor.optional(),
  boxOpacity: z.number().min(0).max(1).optional(),
  marginPx: z.number().int().min(0).max(600).optional(),
  startS: z.number().min(0).max(3600).optional(),
  endS: z.number().min(0).max(3600).nullable().optional(),
  animation: textAnimationEnum.optional(),
});
export type AddTextOverlayInput = z.infer<typeof addTextOverlaySchema>;
