"use client";

import { PolishSection } from "@/components/PolishSection";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

export default function PolishPanel({ windowControls }: PanelProps) {
  const { snapshot, draft, readOnly, setPolish, save, refetch } = useProjectEditor();
  return (
    <PanelChrome title="Polish" icon="✨" {...windowControls}>
      <div className="p-3">
        <PolishSection
          draft={draft}
          readOnly={readOnly}
          setPolish={setPolish}
          projectId={snapshot.id}
          watermarkAssetId={snapshot.watermarkAssetId}
          save={save}
          refetch={refetch}
        />
      </div>
    </PanelChrome>
  );
}
