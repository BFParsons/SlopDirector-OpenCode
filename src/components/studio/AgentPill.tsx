"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useStudioWorkspaceStore } from "@/stores/studioWorkspaceStore";

/** Toolbar pill: the tool an agent is running right now; click opens the Agent panel. */
export function AgentPill() {
  const agentFeed = useProjectStore((s) => s.agentFeed);
  // Select the array itself (stable between events); derive in the component —
  // a selector that builds a new array each call makes zustand re-render forever.
  const activity = useProjectStore((s) => s.activity);
  const running = activity.filter((it) => it.phase === "start");
  const last = activity[activity.length - 1] ?? null;
  const addWindow = useStudioWorkspaceStore((s) => s.addWindow);
  const windows = useStudioWorkspaceStore((s) => s.windows);
  // A clock that ticks every few seconds so a finished call fades from the bar
  // after a minute without reading the time during render.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (agentFeed === "off" || !last) return null;
  const active = running[running.length - 1] ?? null;
  const recent = now > 0 && now - last.at < 60_000;
  if (!active && !recent) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (!windows.some((w) => w.panelType === "agent")) addWindow("agent", "Agent");
      }}
      title="What the agent is doing (opens the Agent panel)"
      className="flex max-w-[9rem] shrink items-center gap-1.5 whitespace-nowrap rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] max-md:hidden"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${active ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} />
      <span className="truncate font-mono">{active ? `${active.tool}…` : `${last.tool} ✓`}</span>
    </button>
  );
}
