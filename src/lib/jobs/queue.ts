import { Prisma, type Job } from "@prisma/client";
import type { JobType } from "@/lib/db/enums";
import { prisma } from "@/lib/db/client";
import { wakeWorker } from "./signal";

export async function enqueue(
  type: JobType,
  payload: Prisma.InputJsonValue,
  opts: {
    projectId?: string;
    availableInMs?: number;
    maxAttempts?: number;
  } = {},
): Promise<Job> {
  const job = await prisma.job.create({
    data: {
      type,
      payload,
      projectId: opts.projectId,
      maxAttempts: opts.maxAttempts ?? 5,
      availableAt: new Date(Date.now() + (opts.availableInMs ?? 0)),
    },
  });
  // Same-process worker: start now instead of on the next poll tick.
  wakeWorker(opts.availableInMs ?? 0);
  return job;
}

/**
 * Atomically claim up to `limit` due jobs using Postgres FOR UPDATE SKIP LOCKED.
 * Safe across concurrent workers.
 */
export async function claimBatch(
  workerId: string,
  limit: number,
): Promise<Job[]> {
  // SQLite (desktop) runs a single in-process worker — no cross-process
  // contention — so a plain find-then-claim is safe and avoids the Postgres-only
  // FOR UPDATE SKIP LOCKED / AT TIME ZONE syntax.
  if (process.env.SLOPSTUDIO_DB === "sqlite") {
    const due = await prisma.job.findMany({
      where: { status: "QUEUED", availableAt: { lte: new Date() } },
      orderBy: { availableAt: "asc" },
      take: limit,
      select: { id: true },
    });
    const ids = due.map((j) => j.id);
    if (ids.length === 0) return [];
    await prisma.job.updateMany({
      where: { id: { in: ids }, status: "QUEUED" },
      data: { status: "RUNNING", lockedBy: workerId, lockedAt: new Date() },
    });
    return prisma.job.findMany({ where: { id: { in: ids }, lockedBy: workerId } });
  }
  // Prisma stores DateTime as tz-naive `timestamp` in UTC, so compare against
  // the current UTC wall clock (not now(), which is timestamptz and would be
  // offset by the server's local time zone).
  return prisma.$queryRaw<Job[]>(Prisma.sql`
    UPDATE "Job" AS j
    SET status = 'RUNNING',
        "lockedAt" = (now() AT TIME ZONE 'UTC'),
        "lockedBy" = ${workerId},
        "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE j.id IN (
      SELECT id FROM "Job"
      WHERE status = 'QUEUED' AND "availableAt" <= (now() AT TIME ZONE 'UTC')
      ORDER BY "availableAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING j.*;
  `);
}

export async function completeJob(id: string): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: { status: "DONE", lockedAt: null, lockedBy: null },
  });
}

/** Put a claimed job back on the queue without counting an attempt. */
export async function requeue(id: string, delayMs: number): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: {
      status: "QUEUED",
      lockedAt: null,
      lockedBy: null,
      availableAt: new Date(Date.now() + delayMs),
    },
  });
  wakeWorker(delayMs);
}

/** Mark a job failed, or re-queue it with backoff if attempts remain. */
export async function failOrRetry(job: Job, error: string): Promise<boolean> {
  const attempts = job.attempts + 1;
  if (attempts >= job.maxAttempts) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        attempts,
        lastError: error.slice(0, 2000),
        lockedAt: null,
        lockedBy: null,
      },
    });
    return false;
  }
  const backoff = Math.min(60_000, 1000 * 2 ** attempts);
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: "QUEUED",
      attempts,
      lastError: error.slice(0, 2000),
      availableAt: new Date(Date.now() + backoff),
      lockedAt: null,
      lockedBy: null,
    },
  });
  wakeWorker(backoff);
  return true;
}

/** Reset jobs whose lease expired (worker crashed mid-run) back to QUEUED. */
export async function recoverStale(leaseMs: number): Promise<number> {
  const res = await prisma.job.updateMany({
    where: {
      status: "RUNNING",
      lockedAt: { lt: new Date(Date.now() - leaseMs) },
    },
    data: { status: "QUEUED", lockedAt: null, lockedBy: null },
  });
  return res.count;
}
