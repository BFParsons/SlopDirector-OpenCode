/**
 * Runs once at server startup. Prepares the embedded DB (desktop), then boots
 * the background job worker (Node runtime only) and ensures a cleanup job is
 * scheduled. Wrapped in try/catch so the app still serves even if the DB isn't
 * reachable yet.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureDesktopDb } = await import("@/lib/db/bootstrap");
    await ensureDesktopDb();
  } catch (e) {
    console.error("[instrumentation] desktop DB bootstrap failed:", e);
  }
  // The worker probes ffmpeg and the GPU before it starts — a few seconds on a
  // cold cache. Don't hold the first HTTP request hostage to it: pages and API
  // routes serve right away, and anything enqueued meanwhile is picked up the
  // moment the worker is up (it kicks the queue once on start).
  void (async () => {
    try {
      const { startWorker } = await import("@/lib/jobs/worker");
      await startWorker();
      const { prisma } = await import("@/lib/db/client");
      const { enqueue } = await import("@/lib/jobs/queue");
      const pending = await prisma.job.count({
        where: { type: "CLEANUP", status: { in: ["QUEUED", "RUNNING"] } },
      });
      if (pending === 0) {
        await enqueue("CLEANUP", {}, { availableInMs: 60_000 });
      }
    } catch (e) {
      console.error("[instrumentation] worker startup deferred:", e);
    }
  })();
}
