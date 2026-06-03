import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";

type Ctx = { params: Promise<{ id: string }> };

// List reusable visual assets in this project — generated clips, uploaded
// videos, and uploaded photos — for re-insertion into the timeline.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);

    // Reusable visual assets across ALL of the user's (non-deleted) projects.
    const assets = await prisma.asset.findMany({
      where: {
        project: { userId: user.id, deletedAt: null },
        kind: { in: ["SHOT_CLIP", "UPLOAD_VIDEO", "UPLOAD_IMAGE", "UPLOAD_AUDIO"] },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        kind: true,
        mime: true,
        sizeBytes: true,
        createdAt: true,
        projectId: true,
        project: { select: { title: true } },
      },
    });

    // Flag assets already placed in the CURRENT project's timeline (hint, not a block).
    const segs = await prisma.segment.findMany({
      where: { projectId: id },
      select: { sourceAssetId: true, clipAssetId: true },
    });
    const used = new Set<string>();
    for (const s of segs) {
      if (s.sourceAssetId) used.add(s.sourceAssetId);
      if (s.clipAssetId) used.add(s.clipAssetId);
    }

    return ok(
      assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        mime: a.mime,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt,
        isVideo: a.kind === "UPLOAD_VIDEO" || a.kind === "SHOT_CLIP",
        isAudio: a.kind === "UPLOAD_AUDIO",
        inUse: used.has(a.id),
        fromCurrent: a.projectId === id,
        projectTitle: a.project.title,
      })),
    );
  } catch (e) {
    return handleApiError(e);
  }
}
