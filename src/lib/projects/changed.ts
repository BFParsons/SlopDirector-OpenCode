import { emitProgress } from "@/lib/jobs/progressBus";

/**
 * Tell every open editor for this project that its state changed on the
 * server. Edits used to reach the UI only through job events; an agent (or a
 * second window) patching the project over the API left the open editor
 * stale until reload. The originating client's id (X-Slop-Client, set by the
 * browser fetch wrapper) rides along so that client can skip its own echo.
 */
export function notifyProjectChanged(
  projectId: string,
  req?: Request | null,
  extra: Record<string, unknown> = {},
): void {
  const clientId = req?.headers.get("x-slop-client") ?? null;
  emitProgress(projectId, { type: "project.changed", clientId, at: Date.now(), ...extra });
}
