import { EventEmitter } from "node:events";

/**
 * In-process pub/sub between the worker and SSE handlers, keyed by projectId.
 * (If the worker is ever split into its own process, swap this for Postgres
 * LISTEN/NOTIFY behind the same interface.)
 */
export interface ProgressEvent {
  type:
    | "project.status"
    | "segment.status"
    | "visual.gen"
    | "script.gen"
    | "vo.status"
    | "assembly.progress"
    | "final.ready"
    | "draft.ready"
    | "project.changed"
    | "error";
  [key: string]: unknown;
}

const g = globalThis as unknown as { sfProgressBus?: EventEmitter };
export const progressBus = g.sfProgressBus ?? new EventEmitter();
progressBus.setMaxListeners(0);
g.sfProgressBus = progressBus;

export function emitProgress(projectId: string, event: ProgressEvent): void {
  progressBus.emit(projectId, event);
}

export function onProgress(
  projectId: string,
  cb: (event: ProgressEvent) => void,
): () => void {
  progressBus.on(projectId, cb);
  return () => progressBus.off(projectId, cb);
}
