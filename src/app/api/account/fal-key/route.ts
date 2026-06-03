import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { encryptSecret, maskKey } from "@/lib/crypto/secret";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";

const bodySchema = z.object({ key: z.string().min(1).max(400) });

// Save the caller's own fal.ai key (encrypted at rest). Returns only a masked
// hint — the plaintext is never read back to the client. fal keys look like
// "<id>:<secret>" (no fixed prefix), so we validate loosely.
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const { key } = await parseJsonBody(request, bodySchema, 8 * 1024);
    const trimmed = key.trim();
    if (trimmed.length < 16 || /\s/.test(trimmed)) {
      return err("That doesn't look like a fal.ai key", 400);
    }
    const hint = maskKey(trimmed);
    await prisma.user.update({
      where: { id: user.id },
      data: { falKeyEnc: encryptSecret(trimmed), falKeyHint: hint },
    });
    return ok({ hint });
  } catch (e) {
    return handleApiError(e);
  }
}

// Clear the personal key — falls back to the shared server key (env FAL_KEY).
export async function DELETE() {
  try {
    const { user } = await requireApiUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { falKeyEnc: null, falKeyHint: null },
    });
    return ok({ hint: null });
  } catch (e) {
    return handleApiError(e);
  }
}
