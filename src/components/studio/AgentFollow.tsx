"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";

/**
 * The invisible editor, part one (outside the editor provider, survives its
 * remounts): clips that just appeared fade in one after another, clips that
 * changed flash, and the newest one scrolls into view. Nothing opens; the
 * timeline itself is the progress display.
 */
export function AgentFollow() {
  const flashIds = useProjectStore((s) => s.flashIds);
  const arrivals = useProjectStore((s) => s.arrivals);
  const follow = useProjectStore((s) => s.follow);
  const agentFeed = useProjectStore((s) => s.agentFeed);

  useEffect(() => {
    if (agentFeed === "off") return;
    const ids = Object.keys(flashIds);
    if (!ids.length) return;
    const arriving = new Set(arrivals);
    const order = new Map(arrivals.map((id, i) => [id, i]));
    const nodes: Element[] = [];
    for (const id of ids) document.querySelectorAll(`[data-clip-id="${CSS.escape(id)}"]`).forEach((n) => nodes.push(n));
    for (const n of nodes) {
      const el = n as HTMLElement;
      const id = el.getAttribute("data-clip-id") ?? "";
      el.classList.remove("agent-flash", "agent-arrive");
      void el.offsetWidth; // restart the animation when the same clip changes twice
      if (arriving.has(id)) {
        el.style.animationDelay = `${Math.min(12, order.get(id) ?? 0) * 140}ms`;
        el.classList.add("agent-arrive");
      } else {
        el.style.animationDelay = "";
        el.classList.add("agent-flash");
      }
    }
    if (follow && nodes.length) {
      const last = nodes[nodes.length - 1] as HTMLElement;
      if ("scrollIntoView" in last) last.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
    const t = setTimeout(() => nodes.forEach((n) => { n.classList.remove("agent-flash", "agent-arrive"); (n as HTMLElement).style.animationDelay = ""; }), 2600 + arrivals.length * 140);
    return () => clearTimeout(t);
  }, [flashIds, arrivals, follow, agentFeed]);

  return null;
}
