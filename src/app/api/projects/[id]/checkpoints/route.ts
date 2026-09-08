import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { ok } from "@/lib/http/response";
import { getOwnedProject } from "@/lib/projects/access";
import {
  type CheckpointData,
  MAX_CHECKPOINTS_PER_PROJECT,
  captureCheckpoint,
  summarize,
} from "@/lib/projects/checkpoints";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ label: z.string().max(200).optional() });

/** GET → checkpoints, newest first. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    const rows = await prisma.projectCheckpoint.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        createdAt: r.createdAt,
        ...summarize(r.data as unknown as CheckpointData),
      })),
    );
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST { label? } → capture the current editable state. */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    const raw = await request.text();
    const body = raw.trim()
      ? await parseJsonBody(new Request(request.url, { method: "POST", headers: request.headers, body: raw }), schema)
      : {};
    const data = await captureCheckpoint(id);
    const row = await prisma.projectCheckpoint.create({
      data: { projectId: id, label: body.label ?? null, data: data as object },
    });
    // Keep the newest N.
    const extra = await prisma.projectCheckpoint.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      skip: MAX_CHECKPOINTS_PER_PROJECT,
      select: { id: true },
    });
    if (extra.length) await prisma.projectCheckpoint.deleteMany({ where: { id: { in: extra.map((x) => x.id) } } });
    return ok({ id: row.id, label: row.label, createdAt: row.createdAt, ...summarize(data) });
  } catch (e) {
    return handleApiError(e);
  }
}
