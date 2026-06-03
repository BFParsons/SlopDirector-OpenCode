import { VIDEO_MODELS } from "@/config/models";
import { requireApiUser } from "@/lib/auth/rbac";
import { decryptUserKey } from "@/lib/openrouter/userKey";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";
import { listVideoModels } from "@/lib/openrouter/video";

/**
 * Proxy the live OpenRouter video model list for the picker. Falls back to the
 * curated catalog if the upstream call fails (or no API key is set yet).
 */
export async function GET() {
  try {
    const { user } = await requireApiUser();
    try {
      const live = await listVideoModels(decryptUserKey(user.openrouterKeyEnc));
      if (Array.isArray(live) && live.length > 0) {
        return ok({ source: "openrouter", models: live });
      }
    } catch {
      /* fall through to curated */
    }
    return ok({ source: "curated", models: VIDEO_MODELS });
  } catch (e) {
    return handleApiError(e);
  }
}
