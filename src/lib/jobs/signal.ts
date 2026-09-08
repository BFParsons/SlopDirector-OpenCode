/**
 * In-process wake signal for the job worker.
 *
 * The worker polls the queue on a timer (WORKER_POLL_MS, 2.5 s) — fine as a
 * safety net, but on the desktop the API routes and the worker share ONE
 * process, so a freshly enqueued render used to sit idle for up to a full poll
 * interval before ffmpeg even started. `enqueue()` now rings this bell and the
 * worker ticks immediately; delayed jobs (retries, overflow re-queues) arm a
 * wake for when they become due.
 *
 * State lives on globalThis: Next compiles instrumentation.ts (where the
 * worker starts) and the route handlers (where jobs are enqueued) into
 * separate bundles, each with its own copy of module-level variables.
 */
type Listener = () => void;

interface SignalState {
  listeners: Set<Listener>;
  timers: Set<NodeJS.Timeout>;
}

const g = globalThis as unknown as { sfJobSignal?: SignalState };
const state: SignalState = (g.sfJobSignal ??= { listeners: new Set(), timers: new Set() });

/** Register a wake listener; returns an unsubscribe function. */
export function onJobWake(listener: Listener): () => void {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

function ring(): void {
  for (const l of state.listeners) {
    try {
      l();
    } catch (e) {
      console.error("[jobs] wake listener failed:", e);
    }
  }
}

/**
 * Wake the worker now (delayMs <= 0) or once a delayed job becomes due. A no-op
 * when no in-process worker is listening (a standalone `pnpm worker` process
 * keeps polling as before).
 */
export function wakeWorker(delayMs = 0): void {
  if (state.listeners.size === 0) return;
  if (delayMs <= 0) {
    setImmediate(ring);
    return;
  }
  // Bound the number of armed timers; the poll timer catches anything beyond.
  if (state.timers.size >= 32) return;
  const t = setTimeout(() => {
    state.timers.delete(t);
    ring();
  }, delayMs);
  t.unref?.();
  state.timers.add(t);
}
