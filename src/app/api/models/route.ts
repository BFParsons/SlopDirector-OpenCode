import { CHAT_MODELS, TTS_MODELS, VIDEO_MODELS } from "@/config/models";
import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";

/** GET → the generation models this build knows (video, TTS, chat) with prices and clip lengths. */
export async function GET() {
  try {
    await requireApiUser();
    return ok({ video: VIDEO_MODELS, tts: TTS_MODELS, chat: CHAT_MODELS });
  } catch (e) {
    return handleApiError(e);
  }
}
