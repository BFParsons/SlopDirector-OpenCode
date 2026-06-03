import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { err, ok } from "@/lib/http/response";
import { createProjectSchema } from "@/lib/validation/project";
import { createProjectBundle, writeProjectManifest } from "@/lib/projects/bundle";

export async function GET() {
  try {
    const { user } = await requireApiUser();
    const projects = await prisma.project.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { finalRender: { select: { assetId: true, status: true } } },
    });
    return ok(
      projects.map((p) => ({
        id: p.id,
        title: p.title,
        subject: p.subject,
        status: p.status,
        createdAt: p.createdAt,
        finalAssetId: p.finalRender?.assetId ?? null,
      })),
    );
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser();
    const body = await parseJsonBody(request, createProjectSchema, 8 * 1024);

    // Portable bundle: create a named folder under the chosen base (or the
    // user's default). If neither is set, fall back to a legacy DB project.
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { defaultProjectFolder: true },
    });
    const base = body.bundleBase ?? dbUser?.defaultProjectFolder ?? null;
    let bundlePath: string | null = null;
    if (base) {
      try {
        bundlePath = await createProjectBundle(base, body.title);
      } catch (e) {
        return err(`Couldn't create the project folder: ${(e as Error).message}`, 400);
      }
    }

    // No auto-generation: the project starts as a DRAFT with empty visual and
    // audio tracks. The user builds each track (AI generation is opt-in).
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        title: body.title,
        bundlePath,
        goal: body.goal,
        subject: body.subject,
        tone: body.tone,
        targetLengthS: body.targetLengthS,
        aspectRatio: body.aspectRatio,
        resolution: body.resolution,
        shotCount: body.shotCount,
        audioMode: body.audioMode ?? "TTS_FROM_SCRIPT",
        llmModel: body.llmModel,
        videoModel: body.videoModel,
        ttsModel: body.ttsModel,
        ttsVoice: body.ttsVoice,
        audioFitMode: body.audioFitMode ?? "PAD_VIDEO",
        status: "DRAFT",
      },
    });

    // Seed the portable project.json (best-effort; the DB row is canonical).
    if (bundlePath) await writeProjectManifest(project.id).catch(() => {});

    return ok({ id: project.id });
  } catch (e) {
    return handleApiError(e);
  }
}
