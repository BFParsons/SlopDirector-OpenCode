import type { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { notifyProjectChanged } from "@/lib/projects/changed";
import { briefSchema, planSchema } from "@/lib/validation/brief";

type Ctx = { params: Promise<{ id: string }> };

/** POST → mark the current plan (and brief) approved. The person's decision, recorded. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    const plan = planSchema.safeParse(project.plan);
    if (!plan.success) return err("No plan to approve", 404);
    const brief = briefSchema.safeParse(project.brief);
    const approvedPlan = { ...plan.data, status: "approved" as const };
    const approvedBrief = brief.success ? { ...brief.data, status: "approved" as const } : null;
    await prisma.project.update({
      where: { id },
      data: { plan: approvedPlan as Prisma.InputJsonValue, ...(approvedBrief ? { brief: approvedBrief as Prisma.InputJsonValue } : {}) },
    });
    notifyProjectChanged(id, req, { reason: "plan" });
    return ok({ plan: approvedPlan, brief: approvedBrief });
  } catch (e) {
    return handleApiError(e);
  }
}
