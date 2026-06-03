"use client";

import { api } from "@/lib/api";

export interface AudioJobView {
  id: string;
  type: "stems" | "transcribe" | "mix";
  status: "running" | "done" | "error";
  progress: number | null;
  message: string;
  result: unknown;
  error: string | null;
}

/**
 * Poll an Audio Studio job until it finishes. Calls `onTick` with each status
 * update so the UI can show a progress bar. Resolves with the final job (or
 * rejects if it ends in error).
 */
export async function pollAudioJob(
  jobId: string,
  onTick: (job: AudioJobView) => void,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<AudioJobView> {
  const interval = opts.intervalMs ?? 1500;
  const timeout = opts.timeoutMs ?? 30 * 60 * 1000; // 30 min ceiling
  const start = performance.now();

  for (;;) {
    const job = await api<AudioJobView>(`/api/audio/jobs/${jobId}`);
    onTick(job);
    if (job.status === "done") return job;
    if (job.status === "error") throw new Error(job.error || "Job failed");
    if (performance.now() - start > timeout) throw new Error("Job timed out");
    await new Promise((r) => setTimeout(r, interval));
  }
}
