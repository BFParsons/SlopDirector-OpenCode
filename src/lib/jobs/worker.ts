import type { Job } from "@prisma/client";
import { env } from "@/env";
import { OpenRouterError } from "@/lib/openrouter/client";
import { getCapabilities, resolveConcurrency, resolveEncoder } from "@/lib/system/capabilities";
import { handlers } from "./handlers";
import { onJobWake } from "./signal";
import { markJobFailure } from "./orchestrator";
import {
  claimBatch,
  completeJob,
  failOrRetry,
  recoverStale,
  requeue,
} from "./queue";

const LEASE_MS = 10 * 60 * 1000; // a job RUNNING longer than this is presumed dead

// Concurrency is resolved from the host at startup (see startWorker). These hold
// safe env-based defaults until then so an early tick never over-fans-out.
let assemblyCap = env.MAX_CONCURRENT_ASSEMBLY;
let videoCap = env.MAX_CONCURRENT_VIDEO;
let overallConcurrency = Math.max(6, videoCap + assemblyCap + 2);

const g = globalThis as unknown as { sfWorkerStarted?: boolean };

const inFlight = new Set<string>();
let activeAssembly = 0;
let activeDownloads = 0;
let activeYtImports = 0;
const ytImportCap = Math.max(1, Number(process.env.YT_IMPORT_CONCURRENCY ?? 3) || 3);
let shuttingDown = false;
let timer: NodeJS.Timeout | null = null;

async function runJob(job: Job): Promise<void> {
  // Strictly cap CPU-bound assembly; re-queue overflow rather than run it.
  if (job.type === "ASSEMBLE_FINAL" && activeAssembly >= assemblyCap) {
    await requeue(job.id, 5000);
    return;
  }
  // Cap concurrent video fetches — the memory/network-heavy step (clip downloads
  // and YouTube imports). Overflow is re-queued rather than fanned out at once.
  const isDownload =
    job.type === "DOWNLOAD_CLIP" ||
    job.type === "IMPORT_YOUTUBE" ||
    job.type === "IMPORT_AUDIO";
  if (isDownload && activeDownloads >= videoCap) {
    await requeue(job.id, 3000);
    return;
  }
  // YouTube imports run a few at a time (YT_IMPORT_CONCURRENCY, default 3): each
  // yt-dlp run gets its own copy of the cookies jar (lib/youtube/import.ts), so
  // the old one-at-a-time rule is gone — an agent fanning out nine clip scouts
  // used to wait on a queue that drained at one clip a minute.
  const isYtImport = job.type === "IMPORT_YOUTUBE" || job.type === "IMPORT_AUDIO";
  if (isYtImport && activeYtImports >= ytImportCap) {
    await requeue(job.id, 3000);
    return;
  }
  const isAssembly = job.type === "ASSEMBLE_FINAL";
  if (isAssembly) activeAssembly++;
  if (isDownload) activeDownloads++;
  if (isYtImport) activeYtImports++;
  inFlight.add(job.id);

  try {
    const handler = handlers[job.type];
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    await handler(payload);
    await completeJob(job.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Deterministic client errors (bad/missing key, 4xx) won't fix on retry —
    // force terminal failure by maxing out the attempt count.
    const nonRetryable = e instanceof OpenRouterError && !e.retryable;
    const retrying = await failOrRetry(
      nonRetryable ? { ...job, attempts: job.maxAttempts } : job,
      message,
    );
    console.error(
      `[worker] job ${job.id} (${job.type}) failed${retrying ? " (will retry)" : ""}: ${message}`,
    );
    if (!retrying) {
      await markJobFailure(job, message);
    }
  } finally {
    inFlight.delete(job.id);
    if (isAssembly) activeAssembly--;
    if (isDownload) activeDownloads--;
    if (isYtImport) activeYtImports--;
    // Capacity just freed up — see if anything is waiting.
    void kick();
  }
}

// Coalesced tick: a wake that lands mid-tick runs ONE more tick afterwards
// instead of overlapping claims (the poll timer and enqueue wakes both land here).
let ticking = false;
let tickPending = false;
async function kick(): Promise<void> {
  if (ticking) {
    tickPending = true;
    return;
  }
  ticking = true;
  try {
    do {
      tickPending = false;
      await tick();
    } while (tickPending && !shuttingDown);
  } finally {
    ticking = false;
  }
}

async function tick(): Promise<void> {
  if (shuttingDown) return;
  const capacity = overallConcurrency - inFlight.size;
  if (capacity <= 0) return;

  let claimed: Job[] = [];
  try {
    claimed = await claimBatch(env.WORKER_ID, capacity);
  } catch (e) {
    console.error("[worker] claimBatch failed:", e);
    return;
  }

  for (const job of claimed) {
    // Fire-and-forget; concurrency is bounded by `capacity` above.
    void runJob(job);
  }
}

/**
 * @param opts.standalone - true when run as a dedicated process (`pnpm worker`).
 *   In that mode the poll timer is kept **ref'd** so it both keeps the process
 *   alive and fires reliably. In-process (Next dev/prod server) we `unref()` it
 *   so the worker never blocks the host server's shutdown.
 */
export async function startWorker(opts: { standalone?: boolean } = {}): Promise<void> {
  if (g.sfWorkerStarted) return;
  if (!env.WORKER_ENABLED) {
    console.log("[worker] disabled via WORKER_ENABLED=false");
    return;
  }
  g.sfWorkerStarted = true;

  // Resolve concurrency + encoder from the host (env vars override). Best-effort:
  // on any probe failure we keep the safe env-based defaults already set above.
  try {
    const [conc, enc, caps] = await Promise.all([
      resolveConcurrency(),
      resolveEncoder(),
      getCapabilities(),
    ]);
    assemblyCap = conc.assembly;
    videoCap = conc.video;
    overallConcurrency = conc.overall;
    console.log(
      `[worker] host: ${caps.cores} cores / ${caps.totalMemGB}GB · tier ${caps.tier} · ` +
        `gpu ${caps.gpu ? `${caps.gpu.vendor}${caps.gpu.vramGB ? ` ${caps.gpu.vramGB}GB` : ""}` : "none"} · ` +
        `encode ${enc.label} · decode ${caps.hwDecode.length ? `VAAPI (${caps.hwDecode.join("/")})` : "CPU"}`,
    );
  } catch (e) {
    console.warn("[worker] capability probe failed, using defaults:", e);
  }

  const recovered = await recoverStale(LEASE_MS).catch(() => 0);
  if (recovered) console.log(`[worker] recovered ${recovered} stale job(s)`);

  console.log(
    `[worker] started (${env.WORKER_ID}), poll ${env.WORKER_POLL_MS}ms + wake on enqueue, ` +
      `concurrency ${overallConcurrency} (assembly ${assemblyCap}, video ${videoCap})`,
  );

  timer = setInterval(() => void kick(), env.WORKER_POLL_MS);
  if (!opts.standalone && typeof timer.unref === "function") timer.unref();
  // Jobs enqueued from this process (API routes, chained stages) start at once.
  const unsubscribe = onJobWake(() => void kick());
  // Anything enqueued while we were probing the host.
  void kick();

  const shutdown = () => {
    shuttingDown = true;
    unsubscribe();
    if (timer) clearInterval(timer);
    console.log(
      `[worker] draining; ${inFlight.size} job(s) in flight, ${activeAssembly} assembling`,
    );
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
