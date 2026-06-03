"use client";

import { type ComponentProps, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SegmentCard } from "./SegmentCard";

type Props = Omit<ComponentProps<typeof SegmentCard>, "dragHandle"> & {
  position: number;
};

/** A SegmentCard made sortable: drag starts only from the grip handle, so the
 *  card's own inputs stay fully interactive. Dragging is disabled (and the grip
 *  hidden) when the card isn't editable, e.g. while a generation is running. */
export function SortableSegment(cardProps: Props) {
  const enabled = cardProps.editable;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardProps.segment.id, disabled: !enabled });

  // While dragging, the card lifts off: scale up + tilt (composed onto dnd-kit's
  // own translate transform so we don't clobber the follow-the-pointer motion).
  const baseTransform = CSS.Transform.toString(transform) ?? "";
  const style: CSSProperties = {
    transform: isDragging
      ? `${baseTransform} scale(1.03) rotate(-1.5deg)`.trim()
      : baseTransform || undefined,
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  const handle = enabled ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className="-my-1 flex shrink-0 cursor-grab touch-none select-none items-center rounded px-2 py-1 text-2xl leading-none text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] active:cursor-grabbing"
    >
      ⠿
    </button>
  ) : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? "rounded-xl opacity-95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)] ring-2 ring-[var(--color-accent)]"
          : undefined
      }
    >
      <SegmentCard {...cardProps} dragHandle={handle} />
    </div>
  );
}
