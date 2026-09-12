"use client";

import { TextOverlaySection } from "@/components/TextOverlaySection";
import { frameSize } from "@/config/frame-sizes";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

export default function TextOverlayPanel({ windowControls }: PanelProps) {
  const { snapshot, draft, readOnly, onTextOverlayChange, save, refetch } = useProjectEditor();
  return (
    <PanelChrome title="Text Overlays" icon="T" {...windowControls}>
      <div className="p-2">
        <TextOverlaySection
          projectId={snapshot.id}
          frame={frameSize(snapshot)}
          overlays={draft.textOverlays}
          readOnly={readOnly}
          onChange={onTextOverlayChange}
          save={save}
          refetch={refetch}
        />
      </div>
    </PanelChrome>
  );
}
