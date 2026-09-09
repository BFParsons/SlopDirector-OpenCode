"use client";

import { AgentLane } from "@/components/AgentLane";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";

export default function AgentLanePanel({ windowControls }: PanelProps) {
  return (
    <PanelChrome title="Agent" icon="🤖" {...windowControls}>
      <AgentLane />
    </PanelChrome>
  );
}
