import type { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { notifyProjectChanged } from "@/lib/projects/changed";
import { briefSchema } from "@/lib/validation/brief";

type Ctx = { params: Promise<{ id: string }> };

/** GET → the pre-production brief (null until the interview has been done). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    const parsed = briefSchema.safeParse(project.brief);
    return ok({ brief: parsed.success ? parsed.data : null });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT → store the brief (whole object; validated). Mirrors tone/goal/subject for the UI. */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    const body = await parseJsonBody(req, briefSchema);
    await prisma.project.update({
      where: { id },
      data: {
        brief: body as Prisma.InputJsonValue,
        tone: body.tone.slice(0, 200),
        goal: body.premise.slice(0, 500),
        subject: (body.production.form ?? body.production.genre).slice(0, 120),
      },
    });
    notifyProjectChanged(id, req, { reason: "brief" });
    return ok({ brief: body });
  } catch (e) {
    return handleApiError(e);
  }
}
