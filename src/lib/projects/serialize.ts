import { estimateCost } from "@/lib/cost/estimate";
import { prisma } from "@/lib/db/client";
import { parseRefIds } from "@/lib/db/reflist";

const AI_SOURCES = new Set(["AI_GENERATED", "UPLOAD_IMAGE_DRIVER"]);

/** Client-facing shape of a project + its render state. Used by GET and SSE. */
export async function projectSnapshot(projectId: string) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      segments: {
        orderBy: { index: "asc" },
        include: {
          elementRefs: {
            orderBy: { index: "asc" },
            include: {
              element: {
                select: {
                  id: true,
                  name: true,
                  kind: true,
                  assetId: true,
                  variants: { select: { id: true, label: true, assetId: true } },
                },
              },
            },
          },
        },
      },
      audioOverlays: { orderBy: { index: "asc" } },
      textOverlays: { orderBy: { index: "asc" } },
      storyElements: {
        orderBy: { index: "asc" },
        include: { variants: { orderBy: { index: "asc" } } },
      },
      voiceover: true,
      finalRender: true,
    },
  });
  if (!p) return null;

  // Only AI work is billed: AI/driver shots (each at its own model) + TTS chars.
  const shots = p.segments
    .filter((s) => AI_SOURCES.has(s.source))
    .map((s) => ({ model: s.videoModel ?? p.videoModel, durationS: s.durationS }));
  const ttsChars =
    p.audioMode === "TTS_FROM_SCRIPT"
      ? (p.voScript?.length ?? 0)
      : p.audioMode === "TTS_VERBATIM"
        ? (p.voVerbatim?.length ?? 0)
        : 0;
  const cost = estimateCost({ ttsModel: p.ttsModel, shots, voScriptChars: ttsChars });

  return {
    id: p.id,
    title: p.title,
    status: p.status,
    error: p.error,
    goal: p.goal,
    subject: p.subject,
    tone: p.tone,
    targetLengthS: p.targetLengthS,
    aspectRatio: p.aspectRatio,
    resolution: p.resolution,
    frameWidth: p.frameWidth,
    frameHeight: p.frameHeight,
    exportCodec: p.exportCodec,
    lutAssetId: p.lutAssetId,
    captionStyle: p.captionStyle,
    audioFitMode: p.audioFitMode,
    shotCount: p.shotCount,
    stylePrompt: p.stylePrompt,
    styleAnchorAssetId: p.styleAnchorAssetId,
    styleStrength: p.styleStrength,
    audioNormalize: p.audioNormalize,
    colorLook: p.colorLook,
    transition: p.transition,
    transitionMs: p.transitionMs,
    fillMode: p.fillMode,
    vignette: p.vignette,
    grain: p.grain,
    audioFadeInS: p.audioFadeInS,
    audioFadeOutS: p.audioFadeOutS,
    captionsEnabled: p.captionsEnabled,
    captionPosition: p.captionPosition,
    captionSizePct: p.captionSizePct,
    watermarkAssetId: p.watermarkAssetId,
    watermarkPosition: p.watermarkPosition,
    watermarkScale: p.watermarkScale,
    watermarkOpacity: p.watermarkOpacity,
    watermarkMargin: p.watermarkMargin,
    audioMode: p.audioMode,
    llmModel: p.llmModel,
    videoModel: p.videoModel,
    ttsModel: p.ttsModel,
    imageModel: p.imageModel,
    ttsVoice: p.ttsVoice,
    concept: p.concept,
    scriptFull: p.scriptFull,
    voScript: p.voScript,
    voVerbatim: p.voVerbatim,
    voDeliveryNotes: p.voDeliveryNotes,
    musicAssetId: p.musicAssetId,
    musicVolume: p.musicVolume,
    musicDucking: p.musicDucking,
    musicMuted: p.musicMuted,
    voVolume: p.voVolume,
    voMuted: p.voMuted,
    visualGenStatus: p.visualGenStatus,
    scriptGenStatus: p.scriptGenStatus,
    estCostCents: p.estCostCents,
    cost,
    audioSession: p.audioSession ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    segments: p.segments.map((s) => ({
      id: s.id,
      index: s.index,
      title: s.title,
      source: s.source,
      prompt: s.prompt,
      videoModel: s.videoModel,
      speed: s.speed,
      durationS: s.durationS,
      sourceDurationS: s.sourceDurationS,
      trimStartS: s.trimStartS,
      imageMotion: s.imageMotion,
      muted: s.muted,
      brightness: s.brightness,
      contrast: s.contrast,
      saturation: s.saturation,
      transform: s.transform,
      effects: s.effects,
      track: s.track,
      audioOnly: s.audioOnly,
      library: s.library,
      offsetS: s.offsetS,
      pip: s.pip,
      status: s.status,
      error: s.error,
      clipAssetId: s.clipAssetId,
      sourceAssetId: s.sourceAssetId,
      refImageId: s.refImageId,
      refRole: s.refRole,
      importUrl: s.importUrl,
      importStartS: s.importStartS,
      importEndS: s.importEndS,
      elementRefs: s.elementRefs.map((r) => {
        const variant = r.variantId
          ? r.element.variants.find((v) => v.id === r.variantId)
          : null;
        return {
          id: r.id,
          elementId: r.elementId,
          name: r.element.name,
          kind: r.element.kind,
          variantId: variant ? variant.id : null, // null if the variant was deleted
          variantLabel: variant?.label ?? null,
          // image to show / condition on: the chosen variant, else the element base
          imageAssetId: variant?.assetId ?? r.element.assetId,
        };
      }),
    })),
    audioOverlays: p.audioOverlays.map((o) => ({
      id: o.id,
      index: o.index,
      label: o.label,
      sourceUrl: o.sourceUrl,
      importStartS: o.importStartS,
      importEndS: o.importEndS,
      offsetS: o.offsetS,
      volume: o.volume,
      included: o.included,
      durationS: o.durationS,
      status: o.status,
      error: o.error,
      assetId: o.assetId,
    })),
    storyElements: p.storyElements.map((el) => ({
      id: el.id,
      kind: el.kind,
      name: el.name,
      prompt: el.prompt,
      assetId: el.assetId,
      refImageIds: parseRefIds(el.refImageIds),
      error: el.error,
      costCents: el.costCents,
      index: el.index,
      variants: el.variants.map((v) => ({
        id: v.id,
        label: v.label,
        prompt: v.prompt,
        assetId: v.assetId,
        error: v.error,
        index: v.index,
      })),
    })),
    textOverlays: p.textOverlays.map((t) => ({
      id: t.id,
      index: t.index,
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
    voiceover: p.voiceover
      ? {
          status: p.voiceover.status,
          source: p.voiceover.source,
          assetId: p.voiceover.assetId,
          durationS: p.voiceover.durationS,
          error: p.voiceover.error,
        }
      : null,
    finalRender: p.finalRender
      ? {
          status: p.finalRender.status,
          assetId: p.finalRender.assetId,
          durationS: p.finalRender.durationS,
          progress: p.finalRender.progress,
          error: p.finalRender.error,
        }
      : null,
  };
}

export type ProjectSnapshot = NonNullable<
  Awaited<ReturnType<typeof projectSnapshot>>
>;
