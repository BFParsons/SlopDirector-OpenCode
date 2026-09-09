import { requireApiUser } from "@/lib/auth/rbac";
import { CAPS } from "@/config/models";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { touchProject } from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { addTextOverlaySchema } from "@/lib/validation/project";
import { notifyProjectChanged } from "@/lib/projects/changed";

type Ctx = { params: Promise<{ id: string }> };

// Add a burned-in text overlay (lower-third, title card, disclaimer). Style and
// timing default to sensible values and are tuned later via the project PATCH.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, addTextOverlaySchema, 16 * 1024);

    const count = await prisma.textOverlay.count({ where: { projectId: id } });
    if (count >= CAPS.maxTextOverlays) {
      return err(`At most ${CAPS.maxTextOverlays} text overlays per video`, 409);
    }

    await prisma.textOverlay.create({
      data: {
        projectId: id,
        index: count,
        text: body.text,
        position: body.position,
        sizePct: body.sizePct,
        color: body.color,
        boxEnabled: body.boxEnabled,
        boxColor: body.boxColor,
        boxOpacity: body.boxOpacity,
        marginPx: body.marginPx,
        startS: body.startS,
        endS: body.endS ?? null,
        animation: body.animation,
        font: body.font,
        outlineW: body.outlineW,
        shadow: body.shadow,
        preset: body.preset ?? null,
      },
    });

    await touchProject(id);
    notifyProjectChanged(id, request);
    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
