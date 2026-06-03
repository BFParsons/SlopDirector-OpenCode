import { destroySession } from "@/lib/auth/session";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";

export async function POST() {
  try {
    await destroySession();
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
