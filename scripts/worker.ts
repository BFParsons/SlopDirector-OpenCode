/**
 * Standalone background-worker process.
 *
 *   pnpm worker
 *
 * Runs the job worker in its OWN Node process, separate from the Next dev
 * server. A heavy render (ffmpeg, large clip download) then competes for memory
 * in this process only — it can no longer balloon the Turbopack dev server's
 * heap and take the whole machine down with it.
 *
 * In dev, set WORKER_ENABLED="false" in .env so the in-process worker
 * (src/instrumentation.ts) stays off and this process is the sole worker.
 * We force it on here regardless, before any module reads env.
 *
 * Env is loaded via `--env-file=.env` (see the package.json "worker" script);
 * tsx does not auto-load .env the way Next does.
 */
process.env.WORKER_ENABLED = "true";

async function main(): Promise<void> {
  const { startWorker } = await import("@/lib/jobs/worker");
  // standalone: keeps the poll timer ref'd so it fires and holds the loop open.
  await startWorker({ standalone: true });
  console.log("[worker] standalone process running — Ctrl-C to stop");

  // Exit cleanly once startWorker's own SIGINT/SIGTERM handler has cleared the
  // poll timer (which lets the event loop drain and the process exit).
  await new Promise<void>((resolve) => {
    const stop = () => {
      console.log("[worker] shutting down");
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  process.exit(0);
}

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
