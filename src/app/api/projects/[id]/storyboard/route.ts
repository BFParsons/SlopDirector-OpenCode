import { readFile } from "node:fs/promises";
import { requireApiUser } from "@/lib/auth/rbac";
import { absolutePath } from "@/lib/assets/storage";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { err } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import { type StoryboardCell, storyboardSheet } from "@/lib/media/storyboard";

type Ctx = { params: Promise<{ id: string }> };

const fmtT = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

/**
 * GET ?cols=4&w=400 → JPEG: the main sequence as a storyboard, one captioned
 * frame per shot (index · start · length · sound · card). Header
 * X-Storyboard-Shots carries [{id,index,startS,durationS}].
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    const url = new URL(req.url);
    const cols = Math.min(8, Math.max(1, Number(url.searchParams.get("cols") ?? 4) || 4));
    const w = Math.min(960, Math.max(160, Number(url.searchParams.get("w") ?? 400) || 400));
    const segments = await prisma.segment.findMany({
      where: { projectId: id, track: 0, audioOnly: false, library: false },
      orderBy: { index: "asc" },
      include: { sourceAsset: true, clipAsset: true },
    });
    const overlays = await prisma.textOverlay.findMany({ where: { projectId: id } });
    const cells: StoryboardCell[] = [];
    const meta: { id: string; index: number; startS: number; durationS: number }[] = [];
    let t = 0;
    for (const s of segments) {
      const asset = s.sourceAsset ?? s.clipAsset;
      if (asset) {
        const still = s.source === "UPLOAD_IMAGE_STILL" || asset.kind === "UPLOAD_IMAGE";
        const card = overlays.find((o) => o.startS <= t + 0.05 && (o.endS == null || o.endS > t + 0.05));
        const caption = `${meta.length + 1} · ${fmtT(t)} · ${s.durationS}s · ${s.muted ? "mute" : "sync"}${card ? ` · "${card.text.replace(/\s+/g, " ").slice(0, 36)}"` : ""}`;
        cells.push({ abs: absolutePath(asset.path), assetId: asset.id, t: still ? 0 : s.trimStartS + Math.min(0.25, s.durationS / 2), caption });
        meta.push({ id: s.id, index: meta.length, startS: +t.toFixed(3), durationS: s.durationS });
      }
      t += s.durationS;
    }
    if (!cells.length) return err("No shots on the main sequence yet", 404);
    const file = await storyboardSheet(id, cells, cols, w);
    const bytes = await readFile(file);
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/jpeg", "cache-control": "no-store", "x-storyboard-shots": JSON.stringify(meta), "x-storyboard-file": encodeURI(file) } });
  } catch (e) {
    return handleApiError(e);
  }
}
