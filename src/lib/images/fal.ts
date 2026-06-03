/**
 * fal.ai (Flux) image provider.
 *
 * Uses fal's queue API: submit a request, poll the status URL, then fetch the
 * result. Text→image goes to FAL_IMAGE_MODEL (default fal-ai/flux/dev). When a
 * style anchor is supplied, we route to FAL_STYLE_MODEL (img2img by default) and
 * pass the anchor as `image_url` for continuity.
 *
 * Guardrails: `enable_safety_checker:false` (SlopStudio is for the user's own
 * legitimate campaign-video creative; the existing visual rule still applies — real-person
 * likenesses come from user-supplied references, not prompts).
 *
 * NOTE: fal's exact field names for IP-Adapter / Redux continuity vary by model;
 * the style path is structured against the documented img2img schema and may need
 * tuning once a FAL_KEY is available to test live. Text→image is stable.
 */
import { env } from "@/env";
import {
  type GenerateImageParams,
  type GeneratedImage,
  type ImageProvider,
  imageDimensions,
} from "./provider";

const FAL_QUEUE = "https://queue.fal.run";

interface FalSubmit {
  request_id: string;
  status_url: string;
  response_url: string;
}

interface FalResult {
  images?: { url: string; width?: number; height?: number; content_type?: string }[];
  seed?: number;
}

const ASPECT_STR: Record<string, string> = { R16_9: "16:9", R9_16: "9:16", R1_1: "1:1" };

/**
 * Build the request body for a generation. Model-aware so non-Flux fal models
 * (Imagen, Seedream, Recraft) don't receive Flux-only params they'd reject.
 * Flux's schema is verified; the others are best-effort — confirm live.
 * Exported for testing.
 */
export function buildFalBody(params: GenerateImageParams): {
  model: string;
  body: Record<string, unknown>;
} {
  // All reference images: uploaded element refs first, then the style/base anchor.
  const allRefs = [...(params.refs ?? []), params.styleRef].filter((r): r is string => !!r);
  const hasStyle = allRefs.length > 0;
  // Pick the model: text->image (no refs), the multi-reference slug (2+ refs, e.g.
  // Kontext multi), or the single-reference slug.
  const model = !hasStyle
    ? (params.model ?? env.FAL_IMAGE_MODEL)
    : allRefs.length > 1 && params.i2iMultiModel
      ? params.i2iMultiModel
      : (params.i2iModel ?? env.FAL_STYLE_MODEL);
  const isKontext = /kontext/i.test(model);
  const isFlux = /flux/i.test(model);
  const isImagen = /imagen/i.test(model);

  // Kontext is an instruction-edit / multi-reference model: the prompt is the
  // desired result, the reference(s) supply identity. No img2img `strength`.
  if (isKontext) {
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      guidance_scale: 3.5,
      num_inference_steps: 30,
      aspect_ratio: ASPECT_STR[params.aspect ?? "R16_9"] ?? "16:9",
    };
    if (params.seed != null) body.seed = params.seed;
    if (hasStyle) {
      if (allRefs.length > 1) body.image_urls = allRefs;
      else body.image_url = allRefs[0];
    }
    return { model, body };
  }

  // Imagen uses an aspect-ratio string and none of the Flux knobs.
  if (isImagen) {
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: ASPECT_STR[params.aspect ?? "R16_9"] ?? "16:9",
      num_images: params.numImages ?? 1,
    };
    if (params.seed != null) body.seed = params.seed;
    return { model, body };
  }

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    image_size: imageDimensions(params.aspect), // explicit hi-res over named presets
    num_images: params.numImages ?? 1,
  };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.seed != null) body.seed = params.seed;
  if (isFlux) {
    body.num_inference_steps = 36; // sharper/more coherent
    body.guidance_scale = 3.5;
    body.enable_safety_checker = false;
  }
  if (hasStyle) {
    if (isFlux) {
      // Flux img2img takes a single base; use the first reference + strength.
      body.image_url = allRefs[0];
      body.strength = clamp01(params.styleStrength ?? 0.85);
    } else {
      // Seedream-style edit endpoints take an array of reference images.
      body.image_urls = allRefs;
    }
  }
  return { model, body };
}

async function falFetch(url: string, apiKey: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const falProvider: ImageProvider = {
  id: "fal",
  label: "fal.ai Flux",
  local: false,
  async generate(params, apiKey) {
    const { model, body } = buildFalBody(params);

    const submitRes = await falFetch(`${FAL_QUEUE}/${model}`, apiKey, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      throw new Error(`fal submit ${submitRes.status}: ${(await submitRes.text()).slice(0, 300)}`);
    }
    const sub = (await submitRes.json()) as FalSubmit;

    // Poll the queue until completion (image gen is typically 5–30s).
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await sleep(2000);
      const stRes = await falFetch(sub.status_url, apiKey);
      if (!stRes.ok) continue;
      const st = (await stRes.json()) as { status?: string };
      if (st.status === "COMPLETED") {
        const res = await falFetch(sub.response_url, apiKey);
        if (!res.ok) throw new Error(`fal result ${res.status}`);
        const out = (await res.json()) as FalResult;
        const images = out.images ?? [];
        if (!images.length) throw new Error("fal returned no images");
        return images.map<GeneratedImage>((im) => ({
          url: im.url,
          width: im.width,
          height: im.height,
          seed: out.seed,
          contentType: im.content_type,
        }));
      }
      if (st.status === "FAILED" || st.status === "ERROR") {
        throw new Error("fal generation failed");
      }
    }
    throw new Error("fal generation timed out");
  },
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
