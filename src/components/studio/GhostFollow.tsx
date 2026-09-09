"use client";

import { useEffect } from "react";
import { segmentStartS, useProjectStore } from "@/stores/projectStore";
import { useProjectEditor } from "./ProjectEditorProvider";

/**
 * The invisible editor, part two (inside the editor provider, which remounts
 * on every server change): select the clip the agent just touched and park
 * the playhead on it so the monitor shows that frame; when a new draft lands,
 * switch the monitor to it.
 */
export function GhostFollow() {
  const { snapshot, setSelectedSegmentId, engine, setMonitorMode, renderAsset } = useProjectEditor();
  const follow = useProjectStore((s) => s.follow);
  const agentFeed = useProjectStore((s) => s.agentFeed);
  const lastChangedId = useProjectStore((s) => s.lastChangedId);
  const lastChangedAt = useProjectStore((s) => s.lastChangedAt);
  const draftArrivedId = useProjectStore((s) => s.draftArrivedId);
  const ackDraft = useProjectStore((s) => s.ackDraft);

  useEffect(() => {
    if (!follow || agentFeed === "off" || !lastChangedId || Date.now() - lastChangedAt > 10_000) return;
    const t = segmentStartS(snapshot, lastChangedId);
    if (t == null) return;
    setSelectedSegmentId(lastChangedId);
    engine.seek(Math.max(0, t + 0.05));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastChangedAt, lastChangedId, follow, agentFeed]);

  useEffect(() => {
    if (!follow || agentFeed === "off" || !draftArrivedId || !renderAsset) return;
    setMonitorMode("rendered");
    engine.seek(0);
    ackDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftArrivedId, renderAsset, follow, agentFeed]);

  return null;
}
