import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { requireApiRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";

const createSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

// List all accounts (admin only).
export async function GET() {
  try {
    await requireApiRole("ADMIN");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    });
    return ok(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        projectCount: u._count.projects,
      })),
    );
  } catch (e) {
    return handleApiError(e);
  }
}

// Create an account (admin only) — the only way to add users now that public
// registration is bootstrap-only.
export async function POST(request: Request) {
  try {
    await requireApiRole("ADMIN");
    const body = await parseJsonBody(request, createSchema, 4096);
    const email = body.email.toLowerCase().trim();

    if (await prisma.user.findUnique({ where: { email } })) {
      return err("Email already registered", 409);
    }
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(body.password),
        role: body.role ?? "USER",
      },
    });
    return ok({ id: user.id, email: user.email, role: user.role });
  } catch (e) {
    return handleApiError(e);
  }
}
