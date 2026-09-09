"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useStudioWorkspaceStore } from "@/stores/studioWorkspaceStore";

/**
 * Follow mode, rendered nowhere: flashes the clips an agent just changed
 * (any element with data-clip-id) and opens the Agent panel the first time
 * activity arrives while it is closed.
 */
export function AgentFollow() {
  const flashIds = useProjectStore((s) => s.flashIds);
  const follow = useProjectStore((s) => s.follow);
  const agentFeed = useProjectStore((s) => s.agentFeed);
  const lastCallId = useProjectStore((s) => s.activity[s.activity.length - 1]?.callId ?? null);

  useEffect(() => {
    if (agentFeed === "off") return;
    const ids = Object.keys(flashIds);
    if (!ids.length) return;
    const nodes: Element[] = [];
    for (const id of ids) document.querySelectorAll(`[data-clip-id="${CSS.escape(id)}"]`).forEach((n) => nodes.push(n));
    for (const n of nodes) {
      n.classList.remove("agent-flash");
      // restart the animation when the same clip changes twice
      void (n as HTMLElement).offsetWidth;
      n.classList.add("agent-flash");
    }
    if (follow && nodes[0] && "scrollIntoView" in nodes[0]) (nodes[0] as HTMLElement).scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    const t = setTimeout(() => nodes.forEach((n) => n.classList.remove("agent-flash")), 2600);
    return () => clearTimeout(t);
  }, [flashIds, follow, agentFeed]);

  useEffect(() => {
    if (!follow || agentFeed === "off" || !lastCallId) return;
    const ws = useStudioWorkspaceStore.getState();
    if (!ws.windows.some((w) => w.panelType === "agent")) ws.addWindow("agent", "Agent");
  }, [lastCallId, follow, agentFeed]);

  return null;
}
