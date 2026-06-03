/**
 * Runs once at server startup. Boots the background job worker (Node runtime
 * only) and ensures a cleanup job is scheduled. Wrapped in try/catch so the app
 * still serves even if the DB isn't reachable yet.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    // Desktop (SQLite) first-launch: create the schema + seed an admin. No-op
    // on the web build (gated on SLOPSTUDIO_DB=sqlite).
    const { ensureDesktopDb } = await import("@/lib/db/bootstrap");
    await ensureDesktopDb();

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
}
