"use client";

import { useCallback, useEffect, useRef } from "react";
import { TimelineView } from "@/components/TimelineView";
import type { MediaDragPayload } from "@/lib/studio/dnd";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

export default function TimelinePanel({ windowControls }: PanelProps) {
  const ed = useProjectEditor();
  const { draft, snapshot, readOnly, selectedSegmentId, setSelectedSegmentId, engine } = ed;

  // The provider re-creates its handlers on every render — including each
  // playhead tick (~16×/s while playing), because it owns the engine's `time`
  // state. Passing those fresh identities into TimelineView would defeat the
  // memoized clip blocks. Wrap them in STABLE identities that call the latest
  // handler through a ref, so the blocks only re-render on real edits.
  const ref = useRef(ed);
  useEffect(() => {
    ref.current = ed;
  });

  const onReorder = useCallback((ids: string[]) => ref.current.onReorder(ids), []);
  const onTrim = useCallback(
    (id: string, patch: { durationS?: number; trimStartS?: number }) =>
      ref.current.onSegmentChange(id, patch),
    [],
  );
  const onSplit = useCallback((id: string, atS: number) => void ref.current.onSplitSegment(id, atS), []);
  const onDelete = useCallback((id: string) => void ref.current.onDeleteSegment(id), []);
  const onOffset = useCallback(
    (id: string, offsetS: number) => ref.current.onSegmentChange(id, { offsetS }),
    [],
  );
  const onDropMedia = useCallback(
    (payload: MediaDragPayload, track: number, offsetS: number) =>
      void ref.current.insertMedia(payload, {
        track,
        offsetS,
        trimStartS: payload.trimStartS,
        durationS: payload.durationS,
      }),
    [],
  );
  const onDropAudio = useCallback(
    (payload: { relPath: string }, offsetS: number, track: number) =>
      void ref.current.insertAudioFromStudio(payload, offsetS, track),
    [],
  );
  const onUnlinkAudio = useCallback((id: string) => void ref.current.onUnlinkAudio(id), []);

  return (
    <PanelChrome title="Timeline" icon="▤" bare {...windowControls}>
      <div className="h-full">
        <TimelineView
          segments={draft.segments}
          overlays={draft.audioOverlays}
          readOnly={readOnly}
          onReorder={onReorder}
          onTrim={onTrim}
          onSplit={onSplit}
          onDelete={onDelete}
          onOffset={onOffset}
          onDropMedia={onDropMedia}
          onDropAudio={onDropAudio}
          onUnlinkAudio={onUnlinkAudio}
          selectedId={selectedSegmentId}
          onSelect={setSelectedSegmentId}
          playheadS={engine.time}
          onSeek={engine.seek}
          projectId={snapshot.id}
        />
      </div>
    </PanelChrome>
  );
}
