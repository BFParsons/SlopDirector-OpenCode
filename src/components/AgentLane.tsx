"use client";

import { useEffect, useRef } from "react";
import { withBase } from "@/lib/basePath";
import { type ActivityItem, type AgentFeedMode, isLookTool, useProjectStore } from "@/stores/projectStore";

/** Preview URL for the tools that looked at a picture (served from the app's own cache). */
function previewUrl(it: ActivityItem): string | null {
  const a = it.args ?? {};
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : null);
  const n = (k: string) => (typeof a[k] === "number" ? (a[k] as number) : null);
  if (it.tool === "get_contact_sheet" && s("assetId")) {
    const q = new URLSearchParams();
    q.set("cols", String(n("cols") ?? 4));
    q.set("rows", String(n("rows") ?? 3));
    q.set("w", String(Math.min(n("width") ?? 1280, 800)));
    if (n("startS") != null) q.set("start", String(n("startS")));
    if (n("endS") != null) q.set("end", String(n("endS")));
    return withBase(`/api/assets/${s("assetId")}/contact-sheet?${q}`);
  }
  if (it.tool === "get_frame" && s("assetId")) return withBase(`/api/assets/${s("assetId")}/frame?t=${n("t") ?? 0}&w=480`);
  if (it.tool === "storyboard_sheet" && it.projectId) return withBase(`/api/projects/${it.projectId}/storyboard?cols=${n("cols") ?? 4}&w=240`);
  return null;
}

const fmtClock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};
const fmtArgs = (a?: Record<string, unknown>) => {
  if (!a) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(a)) {
    if (k === "projectId") continue;
    const val = typeof v === "string" ? (v.length > 48 ? `"${v.slice(0, 45)}…"` : `"${v}"`) : typeof v === "object" ? (Array.isArray(v) ? `[${v.length}]` : "{…}") : String(v);
    parts.push(`${k}=${val}`);
  }
  const line = parts.join(" ");
  return line.length > 160 ? line.slice(0, 157) + "…" : line;
};

/**
 * The agent lane: what an MCP agent is doing to this project, live — one row
 * per tool call with its arguments, result and a thumbnail when it looked at
 * a picture. `compact` drops the controls (the rendering view).
 */
export function AgentLane({ compact = false }: { compact?: boolean }) {
  const { activity, agentFeed, setAgentFeed, follow, setFollow, connected, clearActivity } = useProjectStore();
  const listRef = useRef<HTMLDivElement>(null);
  const items = agentFeed === "changes" ? activity.filter((it) => !isLookTool(it.tool)) : activity;
  const running = activity.filter((it) => it.phase === "start").length;
  const lastPhase = items[items.length - 1]?.phase;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length, lastPhase]);

  return (
    <div className="flex h-full min-h-0 flex-col text-xs">
      {!compact ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-2 py-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-500"}`} title={connected ? "live" : "reconnecting"} />
          <span className="font-medium">Agent</span>
          {running ? <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-300">{running} running</span> : null}
          <span className="flex-1" />
          <label className="flex items-center gap-1 text-[var(--color-muted)]">
            show
            <select
              value={agentFeed}
              onChange={(e) => setAgentFeed(e.target.value as AgentFeedMode)}
              className="rounded border border-[var(--color-border)] bg-transparent px-1 py-0.5 text-xs text-[var(--color-fg)]"
              title="Off: ignore agent events. Changes: only edits, imports, renders. Full: every step, including what the agent looked at."
            >
              <option value="off">off</option>
              <option value="changes">changes</option>
              <option value="full">everything</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-[var(--color-muted)]" title="Follow the agent in the editor: new clips fade in one by one, the changed clip is selected and the playhead parks on it, a new draft takes over the monitor">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> follow
          </label>
          <button type="button" onClick={clearActivity} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]" title="Clear the list">
            clear
          </button>
        </div>
      ) : null}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {agentFeed === "off" ? (
          <p className="py-6 text-center text-[var(--color-muted)]">Agent activity is off.</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-[var(--color-muted)]">
            Nothing yet. When an agent (Claude Code, Codex) works on this project through the MCP server, every step shows up here.
          </p>
        ) : (
          items.map((it) => {
            const img = previewUrl(it);
            const glyph = it.phase === "start" ? "⟳" : it.ok === false ? "✕" : "✓";
            const glyphClass = it.phase === "start" ? "text-amber-300 animate-pulse" : it.ok === false ? "text-red-400" : "text-emerald-400";
            const mutating = !isLookTool(it.tool);
            return (
              <div key={it.callId} className={`border-b border-[var(--color-border)]/60 py-1.5 ${mutating ? "" : "opacity-80"}`}>
                <div className="flex items-baseline gap-2">
                  <span className={`w-3 shrink-0 ${glyphClass}`}>{glyph}</span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted)]">{fmtClock(it.at)}</span>
                  <span className={`shrink-0 font-mono ${mutating ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"}`}>{it.tool}</span>
                  {it.ms != null ? <span className="shrink-0 text-[10px] text-[var(--color-muted)]">{it.ms >= 1000 ? `${(it.ms / 1000).toFixed(1)} s` : `${it.ms} ms`}</span> : null}
                  <span className="min-w-0 truncate text-[var(--color-muted)]" title={fmtArgs(it.args)}>
                    {fmtArgs(it.args)}
                  </span>
                </div>
                {it.summary ? <div className="mt-0.5 line-clamp-2 pl-5 text-[11px] text-[var(--color-muted)]/90">{it.summary}</div> : null}
                {img && it.phase === "end" && it.ok !== false ? (
                  <a href={img} target="_blank" rel="noreferrer" className="mt-1 block pl-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={it.tool} loading="lazy" className="max-h-28 rounded border border-[var(--color-border)] object-contain" />
                  </a>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
