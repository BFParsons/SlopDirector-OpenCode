/**
 * The agent lane: one event per MCP tool call (start / end) so an open editor
 * can show what the agent is doing while it works — the sense of progress the
 * state changes alone don't give. Broadcast on the project's SSE stream as
 * `agent.activity` and kept in a per-project ring buffer so a window opened
 * mid-job sees the recent history.
 */
import { z } from "zod";
import { emitProgress } from "@/lib/jobs/progressBus";

export const activitySchema = z.object({
  projectId: z.string().optional(),
  assetId: z.string().optional(),
  callId: z.string().min(1).max(64),
  phase: z.enum(["start", "end"]),
  tool: z.string().min(1).max(64),
  args: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().max(400).optional(),
  ok: z.boolean().optional(),
  ms: z.number().min(0).optional(),
  agent: z.string().max(80).optional(),
});
export type ActivityInput = z.infer<typeof activitySchema>;
export type ActivityEvent = ActivityInput & { projectId: string; at: number; type: "agent.activity" };

const MAX = 300;
const g = globalThis as unknown as { __slopActivity?: Map<string, ActivityEvent[]> };
const buffers = (g.__slopActivity ??= new Map<string, ActivityEvent[]>());

export function recordActivity(projectId: string, input: ActivityInput): ActivityEvent {
  const ev: ActivityEvent = { ...input, projectId, at: Date.now(), type: "agent.activity" };
  const buf = buffers.get(projectId) ?? [];
  buf.push(ev);
  if (buf.length > MAX) buf.splice(0, buf.length - MAX);
  buffers.set(projectId, buf);
  emitProgress(projectId, ev);
  return ev;
}

export function recentActivity(projectId: string, limit = 100): ActivityEvent[] {
  const buf = buffers.get(projectId) ?? [];
  return buf.slice(-limit);
}
