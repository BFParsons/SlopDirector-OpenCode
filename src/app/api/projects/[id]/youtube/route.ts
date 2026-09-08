import { env } from "@/env";
import { CAPS } from "@/config/models";
import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { enqueue } from "@/lib/jobs/queue";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";
import { importYoutubeSchema } from "@/lib/validation/project";
import { canonicalYouTubeUrl, parseYouTubeId } from "@/lib/youtube/url";
import { notifyProjectChanged } from "@/lib/projects/changed";

type Ctx = { params: Promise<{ id: string }> };

// Queue a YouTube clip import. Creates a placeholder UPLOAD_VIDEO segment in
// DOWNLOADING state that the worker fills in via yt-dlp.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);
    if (project.status === "RENDERING") {
      return err("Cannot edit a project while it is RENDERING", 409);
    }

    const body = await parseJsonBody(request, importYoutubeSchema, 8 * 1024);
    const videoId = parseYouTubeId(body.url);
    if (!videoId) return err("Enter a valid YouTube URL", 400);

    const startS = Math.floor(body.startS);
    const endS = Math.floor(body.endS);
    if (endS <= startS) return err("Clip end must be after the start", 400);
    const len = endS - startS;
    if (len > env.YT_IMPORT_MAX_SECONDS) {
      return err(`Clip too long (max ${env.YT_IMPORT_MAX_SECONDS}s)`, 400);
    }

    // Audio overlay: download audio only, mixed over the final (no visual segment).
    if (body.kind === "audio") {
      const overlayCount = await prisma.audioOverlay.count({ where: { projectId: id } });
      if (overlayCount >= CAPS.maxAudioOverlays) {
        return err(`Maximum ${CAPS.maxAudioOverlays} audio overlays`, 400);
      }
      const maxOverlayIdx = (
        await prisma.audioOverlay.aggregate({ where: { projectId: id }, _max: { index: true } })
      )._max.index;
      const overlay = await prisma.audioOverlay.create({
        data: {
          projectId: id,
          index: maxOverlayIdx == null ? 0 : maxOverlayIdx + 1,
          sourceUrl: canonicalYouTubeUrl(videoId),
          importStartS: startS,
          importEndS: endS,
          status: "PENDING",
        },
      });
      await enqueue("IMPORT_AUDIO", { overlayId: overlay.id }, { projectId: id });
      notifyProjectChanged(id, request);
      return ok(await projectSnapshot(id));
    }

    const count = await prisma.segment.count({ where: { projectId: id } });
    if (count >= CAPS.maxSegments) {
      return err(`Maximum ${CAPS.maxSegments} segments`, 400);
    }

    const maxIdx = (
      await prisma.segment.aggregate({
        where: { projectId: id },
        _max: { index: true },
      })
    )._max.index;
    const index = maxIdx == null ? 0 : maxIdx + 1;

    const segment = await prisma.segment.create({
      data: {
        projectId: id,
        index,
        source: "UPLOAD_VIDEO",
        status: "DOWNLOADING",
        durationS: len,
        importUrl: canonicalYouTubeUrl(videoId),
        importStartS: startS,
        importEndS: endS,
      },
    });
    await enqueue("IMPORT_YOUTUBE", { segmentId: segment.id }, { projectId: id });

    notifyProjectChanged(id, request);

    return ok(await projectSnapshot(id));
  } catch (e) {
    return handleApiError(e);
  }
}
