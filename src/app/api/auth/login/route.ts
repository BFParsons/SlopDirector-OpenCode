import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rateLimit";
import { AuthError } from "@/lib/auth/rbac";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/http/clientIp";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { ok } from "@/lib/http/response";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!rateLimit(`login:${ip}`, 10, 60_000).ok) {
      throw new AuthError("Too many attempts, slow down", 429);
    }

    const body = await parseJsonBody(request, schema, 4096);
    const email = body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Spend roughly the same time as a real verify to blunt user enumeration.
      await verifyPassword(
        "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaA",
        body.password,
      );
      throw new AuthError("Invalid email or password", 401);
    }

    const valid = await verifyPassword(user.passwordHash, body.password);
    if (!valid) throw new AuthError("Invalid email or password", 401);

    await createSession(user.id, {
      ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
      remember: body.remember,
    });

    return ok({ id: user.id, email: user.email, role: user.role });
  } catch (e) {
    return handleApiError(e);
  }
}
