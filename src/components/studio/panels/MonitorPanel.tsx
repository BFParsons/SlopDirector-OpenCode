"use client";

import { ProgramMonitor } from "@/components/timeline/ProgramMonitor";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

export default function MonitorPanel({ windowControls }: PanelProps) {
  const { engine, previewSpec, renderAsset, dirty, setMonitorMode, effectiveMode } =
    useProjectEditor();
  return (
    <PanelChrome title="Program Monitor" icon="▣" {...windowControls}>
      <div className="h-full p-2">
        <ProgramMonitor
          mode={effectiveMode}
          onMode={setMonitorMode}
          engine={engine}
          spec={previewSpec}
          renderAsset={renderAsset}
          dirty={dirty}
        />
      </div>
    </PanelChrome>
  );
}
