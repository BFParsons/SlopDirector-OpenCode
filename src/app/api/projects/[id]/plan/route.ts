import type { Prisma } from "@prisma/client";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { requireApiUser } from "@/lib/auth/rbac";
import { projectDir } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { notifyProjectChanged } from "@/lib/projects/changed";
import { checkPlan, planCli, planDocument, planTable, planTasks } from "@/lib/projects/plan";
import { briefSchema, planSchema } from "@/lib/validation/brief";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET ?view=json|document|table|cli|check|tasks → the proposed/approved plan, its
 * mechanical check against the brief, the markdown document (or the terminal
 * text) for approval, or the task graph an orchestrator fans out.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    const view = new URL(req.url).searchParams.get("view") ?? "json";
    const plan = planSchema.safeParse(project.plan);
    const brief = briefSchema.safeParse(project.brief);
    if (!plan.success) return view === "json" ? ok({ plan: null, brief: brief.success ? brief.data : null, check: null }) : err("No plan yet — PUT one first", 404);
    const b = brief.success ? brief.data : null;
    if (view === "document") return ok({ markdown: planDocument(plan.data, b, project.title), check: checkPlan(plan.data, b) });
    if (view === "cli") return ok({ text: planCli(plan.data, b, project.title), check: checkPlan(plan.data, b) });
    if (view === "table") {
      const width = Number(new URL(req.url).searchParams.get("width") ?? 110) || 110;
      return ok({ text: planTable(plan.data, b, project.title, width), check: checkPlan(plan.data, b) });
    }
    if (view === "check") return ok(checkPlan(plan.data, b));
    if (view === "tasks") return ok(planTasks(plan.data));
    return ok({ plan: plan.data, brief: b, check: checkPlan(plan.data, b) });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * PUT → store a proposed plan (whole object; validated). The version bumps,
 * status is always "proposed" here (approve with POST …/plan/approve). Returns
 * the check and writes plan-v<N>.md next to the project's assets.
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    const body = await parseJsonBody(req, planSchema, 512 * 1024);
    const prev = planSchema.safeParse(project.plan);
    const plan = { ...body, version: (prev.success ? prev.data.version : 0) + 1, status: "proposed" as const };
    const brief = briefSchema.safeParse(project.brief);
    const b = brief.success ? brief.data : null;
    await prisma.project.update({ where: { id }, data: { plan: plan as Prisma.InputJsonValue } });
    const check = checkPlan(plan, b);
    let documentPath: string | null = null;
    try {
      documentPath = path.join(projectDir(id), `plan-v${plan.version}.md`);
      await writeFile(documentPath, planDocument(plan, b, project.title), "utf8");
    } catch {
      documentPath = null;
    }
    notifyProjectChanged(id, req, { reason: "plan" });
    return ok({ plan, check, documentPath });
  } catch (e) {
    return handleApiError(e);
  }
}
