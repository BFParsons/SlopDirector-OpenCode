import { requireApiUser } from "@/lib/auth/rbac";
import { getVideoModel } from "@/config/models";
import { estimateCost } from "@/lib/cost/estimate";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err, ok } from "@/lib/http/response";
import {
  aiSegmentNeedsRender,
  startRender,
  voNeedsSynth,
} from "@/lib/jobs/orchestrator";
import { getOwnedProject } from "@/lib/projects/access";
import { exportFormats } from "@/lib/system/capabilities";

type Ctx = { params: Promise<{ id: string }> };

const RENDERABLE = new Set(["DRAFT", "FAILED", "DONE"]);

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function ttsCharsFor(p: {
  audioMode: string;
  voScript: string | null;
  voVerbatim: string | null;
}): number {
  if (p.audioMode === "TTS_FROM_SCRIPT") return p.voScript?.length ?? 0;
  if (p.audioMode === "TTS_VERBATIM") return p.voVerbatim?.length ?? 0;
  return 0;
}

async function buildPreview(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { segments: { orderBy: { index: "asc" } }, voiceover: true },
  });
  if (!project) return null;
  // Only count work that will actually run: already-rendered clips and a ready
  // voiceover are reused for free on a re-render (mirrors startRender). Each
  // shot bills at its own (possibly overridden) model.
  const shots = project.segments
    .filter(aiSegmentNeedsRender)
    .map((s) => ({ model: s.videoModel ?? project.videoModel, durationS: s.durationS }));
  const voScriptChars = voNeedsSynth(project.audioMode, project.voiceover)
    ? ttsCharsFor(project)
    : 0;
  const cost = estimateCost({ ttsModel: project.ttsModel, shots, voScriptChars });
  return {
    project,
    hasAiSegments: shots.length > 0,
    cost,
    videoModelInfo: getVideoModel(project.videoModel) ?? null,
    adminOnly: shots.some((s) => getVideoModel(s.model)?.adminOnly === true),
  };
}

// Cost preview
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);

    const preview = await buildPreview(id);
    if (!preview) return err("Project not found", 404);

    const usedThisMonth = await prisma.project.count({
      where: {
        userId: user.id,
        deletedAt: null,
        status: { in: ["RENDERING", "DONE"] },
        updatedAt: { gte: startOfMonth() },
      },
    });

    return ok({
      cost: preview.cost,
      videoModel: preview.project.videoModel,
      videoModelInfo: preview.videoModelInfo,
      adminOnlyModel: preview.adminOnly,
      quota: { used: usedThisMonth, limit: user.quotaAdsMonth },
      // Which codecs this host can encode (and whether a GPU backend validated).
      formats: await exportFormats(),
      exportCodec: preview.project.exportCodec,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

// Confirm + start render
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user);

    if (!RENDERABLE.has(project.status)) {
      return err(`Cannot render while ${project.status}`, 409);
    }

    const segments = await prisma.segment.findMany({
      where: { projectId: id },
      orderBy: { index: "asc" },
    });
    if (segments.length === 0) {
      return err("Add at least one visual segment before rendering", 400);
    }
    // A YouTube import that hasn't produced its file yet (in flight or failed)
    // would assemble to nothing — make the user resolve it first.
    if (segments.some((s) => s.importUrl && !s.sourceAssetId)) {
      return err(
        "A YouTube import is still in progress or failed — wait for it, retry, or remove it",
        400,
      );
    }

    const voiceover = await prisma.voiceoverAsset.findUnique({
      where: { projectId: id },
    });

    // Audio-track readiness depends on the mode.
    if (project.audioMode === "TTS_FROM_SCRIPT" && !project.voScript?.trim()) {
      return err("Write or generate a voiceover script first", 400);
    }
    if (project.audioMode === "TTS_VERBATIM" && !project.voVerbatim?.trim()) {
      return err("Enter the verbatim voiceover transcript first", 400);
    }
    if (project.audioMode === "UPLOAD_AUDIO" && !voiceover?.assetId) {
      return err("Upload the audio track first", 400);
    }

    // Only segments that aren't already rendered will incur AI cost / gating.
    const aiToRender = segments.filter(aiSegmentNeedsRender);

    // Admin gate: block if ANY shot's effective model is admin-only (per-segment).
    if (user.role !== "ADMIN") {
      const gated = aiToRender
        .map((s) => s.videoModel ?? project.videoModel)
        .find((m) => getVideoModel(m)?.adminOnly === true);
      if (gated) {
        return err(`The model "${gated}" is restricted to admins (cost control)`, 403);
      }
    }

    const cost = estimateCost({
      ttsModel: project.ttsModel,
      shots: aiToRender.map((s) => ({
        model: s.videoModel ?? project.videoModel,
        durationS: s.durationS,
      })),
      voScriptChars: voNeedsSynth(project.audioMode, voiceover)
        ? ttsCharsFor(project)
        : 0,
    });

    // The monthly quota is a cost guard for AI generation. A local ffmpeg
    // re-assembly of the user's own clips bills nothing, so it isn't capped —
    // this is a desktop NLE, not a metered ad generator. (Deleted projects no
    // longer count either.)
    if (cost.totalCents > 0) {
      const usedThisMonth = await prisma.project.count({
        where: {
          userId: user.id,
          deletedAt: null,
          status: { in: ["RENDERING", "DONE"] },
          updatedAt: { gte: startOfMonth() },
        },
      });
      if (usedThisMonth >= user.quotaAdsMonth) {
        return err(
          `Monthly AI video quota reached (${usedThisMonth}/${user.quotaAdsMonth})`,
          429,
        );
      }
    }
    await prisma.project.update({
      where: { id },
      data: { estCostCents: cost.totalCents },
    });

    await startRender(id);
    return ok({ ok: true, estCostCents: cost.totalCents });
  } catch (e) {
    return handleApiError(e);
  }
}
