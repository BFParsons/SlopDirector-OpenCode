/**
 * Image-provider seam for SlopStudio's storyboard mode.
 *
 * Storyboard mode is built around image generation: keyframes that lock style +
 * characters, then animated into video (image-to-video) so continuity carries
 * across the whole video. This module is the provider-agnostic contract.
 *
 * Backends:
 *   - fal.ai (Flux)        — cloud, works on any machine (default; see fal.ts)
 *   - local ComfyUI        — tier-2 GPU machines (lands later)
 *
 * Continuity is expressed as a STYLE ANCHOR (reference image + prompt, applied
 * across every shot via IP-Adapter / Flux Redux / img2img) plus an optional
 * character reference and a locked seed.
 */
import type { AspectRatio } from "@/lib/db/enums";

export interface GenerateImageParams {
  prompt: string;
  negativePrompt?: string;
  /** reuse the project's aspect ratio for the keyframe */
  aspect?: AspectRatio;
  /** lock the seed for reproducible / consistent shots */
  seed?: number;
  numImages?: number;
  /** style anchor: a data-URI or URL the provider conditions on (continuity) */
  styleRef?: string;
  /** 0..1 — how strongly the style anchor steers the result */
  styleStrength?: number;
  /** optional character reference for cross-shot character continuity */
  characterRef?: string;
  /** additional reference images (data-URIs) — e.g. user-uploaded element refs */
  refs?: string[];
  /** fal text->image model slug (overrides env default) */
  model?: string;
  /** fal image->image model slug used when a single reference is present */
  i2iModel?: string;
  /** fal multi-reference model slug (e.g. Kontext multi) for 2+ references */
  i2iMultiModel?: string;
}

export interface GeneratedImage {
  /** provider-hosted URL to download the result from */
  url: string;
  width?: number;
  height?: number;
  seed?: number;
  contentType?: string;
}

export interface ImageProvider {
  id: string;
  label: string;
  /** true when the provider runs locally (no per-image cloud cost) */
  local: boolean;
  generate(params: GenerateImageParams, apiKey: string): Promise<GeneratedImage[]>;
}

/** Map the project aspect ratio to a square/landscape/portrait size hint. */
export type SizePreset = "landscape_16_9" | "portrait_16_9" | "square_hd";

export function sizePreset(aspect: AspectRatio | undefined): SizePreset {
  switch (aspect) {
    case "R9_16":
      return "portrait_16_9";
    case "R1_1":
      return "square_hd";
    default:
      return "landscape_16_9";
  }
}

/**
 * Explicit pixel dimensions (higher-res than fal's named presets, which top out
 * ~1024px) for sharper keyframes worth examining at full size.
 */
export function imageDimensions(aspect: AspectRatio | undefined): { width: number; height: number } {
  switch (aspect) {
    case "R9_16":
      return { width: 768, height: 1344 };
    case "R1_1":
      return { width: 1024, height: 1024 };
    default:
      return { width: 1344, height: 768 };
  }
}
