import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { prisma } from "@/lib/db/client";
import { setSegmentStatus } from "@/lib/jobs/orchestrator";
import { enqueue } from "@/lib/jobs/queue";

/**
 * OpenRouter video webhook. Verifies the HMAC signature, then advances the
 * matching segment idempotently. The polling reconciler is the safety net, so a
 * dropped or duplicate webhook is harmless.
 *
 * NOTE: the exact signature scheme (`X-OpenRouter-Signature`) is assumed to be
 * HMAC-SHA256 over the raw body — verify against OpenRouter's spec before
 * relying on it in production.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  // Fail closed: with no configured secret we can't authenticate the caller, so
  // reject. Webhooks are optional (the reconcile poller advances jobs); set
  // OPENROUTER_WEBHOOK_SECRET to enable them.
  const secret = env.OPENROUTER_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("webhook not configured", { status: 503 });
  }
  const header = (request.headers.get("x-openrouter-signature") ?? "").replace(
    /^sha256=/,
    "",
  );
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const data = (event.data ?? {}) as Record<string, unknown>;
  const jobId =
    (event.id as string) ?? (event.job_id as string) ?? (data.id as string);
  const type = String(event.type ?? event.event ?? "");
  if (!jobId) return new Response("ok", { status: 200 });

  const segment = await prisma.segment.findUnique({
    where: { providerJobId: jobId },
  });
  if (!segment) return new Response("ok", { status: 200 });
  if (segment.status === "READY" || segment.status === "DOWNLOADING") {
    return new Response("ok", { status: 200 });
  }

  if (type.includes("completed")) {
    await setSegmentStatus(segment.id, "DOWNLOADING");
    await enqueue("DOWNLOAD_CLIP", { segmentId: segment.id }, { projectId: segment.projectId });
  } else if (type.includes("failed")) {
    await setSegmentStatus(segment.id, "FAILED", {
      error: "provider webhook reported failure",
    });
  }

  return new Response("ok", { status: 200 });
}
