"use client";

import { AudioSection } from "@/components/AudioSection";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

export default function AudioPanel({ windowControls }: PanelProps) {
  const { snapshot, draft, readOnly, setAudio, save, refetch } = useProjectEditor();
  return (
    <PanelChrome title="Audio" icon="🔊" {...windowControls}>
      <div className="p-3">
        <AudioSection
          projectId={snapshot.id}
          draft={draft}
          voiceover={snapshot.voiceover}
          musicAssetId={snapshot.musicAssetId}
          scriptGenStatus={snapshot.scriptGenStatus}
          readOnly={readOnly}
          setAudio={setAudio}
          save={save}
          refetch={refetch}
        />
      </div>
    </PanelChrome>
  );
}
