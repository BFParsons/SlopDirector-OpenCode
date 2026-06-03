import { z } from "zod";
import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/http/handleError";
import { parseJsonBody } from "@/lib/http/parseJsonBody";
import { ok } from "@/lib/http/response";

export const dynamic = "force-dynamic";

const trackSchema = z.object({
  name: z.string().max(300),
  relPath: z.string().min(1),
  url: z.string().min(1),
  durationS: z.number(),
  sourceDurationS: z.number().optional(),
  trimStartS: z.number().optional(),
  kind: z.string().optional(),
  color: z.string().optional(),
  muted: z.boolean().optional(),
  solo: z.boolean().optional(),
  volume: z.number().optional(),
  offsetS: z.number().optional(),
  bpm: z.number().nullable().optional(),
  beats: z.array(z.number()).optional(),
});

const schema = z.object({ tracks: z.array(trackSchema).max(128) });

type Ctx = { params: Promise<{ id: string }> };

/** Persist the Audio Studio's editable multitrack arrangement (JSON) so it can
 *  be reopened. Pass `{ tracks: [] }` to clear it. */
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);
    const body = await parseJsonBody(request, schema, 4 * 1024 * 1024);
    await prisma.project.update({
      where: { id },
      data: {
        audioSession: body.tracks.length
          ? JSON.stringify({ version: 1, tracks: body.tracks })
          : null,
      },
    });
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
