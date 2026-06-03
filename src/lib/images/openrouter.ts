/**
 * OpenRouter image provider — for image-output models like Google's Gemini 2.5
 * Flash Image ("Nano Banana"). Unlike fal, these run through OpenRouter's chat
 * completions API with `modalities: ["image", "text"]`: the prompt (and any
 * reference images, as image_url parts) go in as a user message, and the model
 * returns the generated image as a base64 data-URI in `message.images`.
 *
 * Nano Banana is the standout for subject/character consistency and reference
 * editing — pass a reference image and it preserves identity far better than
 * Flux img2img. (Google-moderated, so keep to generic/archetypal subjects.)
 *
 * NOTE: best-effort against OpenRouter's documented image-output shape; confirm
 * live with a key. Billed to the user's OpenRouter account.
 */
import { env } from "@/env";
import {
  type GenerateImageParams,
  type GeneratedImage,
  type ImageProvider,
} from "./provider";

interface ORImagePart {
  type?: string;
  image_url?: { url?: string };
}
interface ORResponse {
  choices?: { message?: { images?: ORImagePart[] } }[];
  error?: { message?: string };
}

export const openrouterImageProvider: ImageProvider = {
  id: "openrouter",
  label: "OpenRouter (image)",
  local: false,
  async generate(params, apiKey) {
    // One user message: the prompt plus every reference image (uploaded refs,
    // style anchor, character ref). Nano Banana fuses them all + preserves identity.
    const content: Array<Record<string, unknown>> = [{ type: "text", text: params.prompt }];
    const refs = [...(params.refs ?? []), params.styleRef, params.characterRef].filter(
      (r): r is string => !!r,
    );
    for (const ref of refs) content.push({ type: "image_url", image_url: { url: ref } });

    const res = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model ?? "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter image ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as ORResponse;
    if (data.error?.message) throw new Error(`OpenRouter image: ${data.error.message}`);

    const images = data.choices?.[0]?.message?.images ?? [];
    const urls = images.map((im) => im.image_url?.url).filter((u): u is string => !!u);
    if (!urls.length) throw new Error("OpenRouter returned no image");

    return urls.map<GeneratedImage>((url) => ({
      url, // base64 data-URI; the seam decodes it directly
      contentType: url.startsWith("data:image/png") ? "image/png" : "image/jpeg",
    }));
  },
};

export type { GenerateImageParams };
