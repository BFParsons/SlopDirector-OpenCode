"use client";

import { VisualSection } from "@/components/VisualSection";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

export default function VisualPanel({ windowControls }: PanelProps) {
  const { snapshot, draft, isAdmin, readOnly, onSegmentChange, onReorder, save, refetch } =
    useProjectEditor();
  return (
    <PanelChrome title="Visual / Media" icon="🎬" {...windowControls}>
      <div className="p-3">
        <VisualSection
          projectId={snapshot.id}
          segments={draft.segments}
          concept={snapshot.concept}
          voiceoverDurationS={snapshot.voiceover?.durationS ?? null}
          isAdmin={isAdmin}
          projectVideoModel={snapshot.videoModel}
          readOnly={readOnly}
          onSegmentChange={onSegmentChange}
          onReorder={onReorder}
          save={save}
          refetch={refetch}
        />
      </div>
    </PanelChrome>
  );
}
