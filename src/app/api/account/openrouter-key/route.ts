import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { encryptSecret, maskKey } from "@/lib/crypto/secret";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";

const bodySchema = z.object({ key: z.string().min(1).max(400) });

// Save the caller's own OpenRouter key (encrypted at rest). Returns only a
// masked hint — the plaintext is never read back to the client.
export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const { key } = await parseJsonBody(request, bodySchema, 8 * 1024);
    const trimmed = key.trim();
    if (!trimmed.startsWith("sk-") || trimmed.length < 20) {
      return err("That doesn't look like an OpenRouter key (expected sk-or-…)", 400);
    }
    const hint = maskKey(trimmed);
    await prisma.user.update({
      where: { id: user.id },
      data: { openrouterKeyEnc: encryptSecret(trimmed), openrouterKeyHint: hint },
    });
    return ok({ hint });
  } catch (e) {
    return handleApiError(e);
  }
}

// Clear the personal key — falls back to the shared server key.
export async function DELETE() {
  try {
    const { user } = await requireApiUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { openrouterKeyEnc: null, openrouterKeyHint: null },
    });
    return ok({ hint: null });
  } catch (e) {
    return handleApiError(e);
  }
}
