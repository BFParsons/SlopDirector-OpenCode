/**
 * In-memory registry for the Audio Studio's long-running jobs (stem separation,
 * transcription). These outlive a single request but don't warrant a DB row —
 * the client starts a job, gets an id, then polls `/api/audio/jobs/[id]`.
 *
 * Pinned on globalThis so Next's dev hot-reload (which re-evaluates modules)
 * doesn't drop in-flight jobs, exactly like `lib/jobs/progressBus`.
 */
import { randomUUID } from "node:crypto";

export type AudioJobType = "stems" | "transcribe" | "mix";
export type AudioJobStatus = "running" | "done" | "error";

export interface AudioJob {
  id: string;
  projectId: string;
  type: AudioJobType;
  status: AudioJobStatus;
  /** 0..1, or null when the underlying tool reports no progress. */
  progress: number | null;
  message: string;
  /** Populated on success — shape depends on the job type. */
  result: unknown;
  error: string | null;
  startedAt: number;
}

const g = globalThis as unknown as { sfAudioJobs?: Map<string, AudioJob> };
const jobs: Map<string, AudioJob> = g.sfAudioJobs ?? new Map();
g.sfAudioJobs = jobs;

export function createJob(projectId: string, type: AudioJobType): AudioJob {
  const job: AudioJob = {
    id: randomUUID(),
    projectId,
    type,
    status: "running",
    progress: null,
    message: "Starting…",
    result: null,
    error: null,
    startedAt: Date.now(),
  };
  jobs.set(job.id, job);
  // Bound memory: drop jobs older than an hour whenever we add one.
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, j] of jobs) if (j.startedAt < cutoff) jobs.delete(id);
  return job;
}

export function getJob(id: string): AudioJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Omit<AudioJob, "id">>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function finishJob(id: string, result: unknown): void {
  updateJob(id, { status: "done", progress: 1, message: "Complete", result });
}

export function failJob(id: string, error: string): void {
  updateJob(id, { status: "error", message: "Failed", error });
}
