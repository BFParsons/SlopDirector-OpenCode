"use client";

import type { ProjectSnapshot } from "@/lib/projects/serialize";
import { Card, StatusBadge } from "@/components/ui";

export function ProgressTimeline({
  snapshot,
  assemblyPercent,
}: {
  snapshot: ProjectSnapshot;
  assemblyPercent: number;
}) {
  const finalProgress = snapshot.finalRender?.progress ?? assemblyPercent;
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium">Segments</h3>
        <div className="space-y-2">
          {snapshot.segments.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <span className="truncate">
                {s.index + 1}. {s.title ?? (s.prompt ? s.prompt.slice(0, 60) : s.source)}
              </span>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      </div>

      {snapshot.audioMode !== "NONE" ? (
        <div className="flex items-center justify-between text-sm">
          <span>Audio</span>
          <StatusBadge status={snapshot.voiceover?.status ?? "PENDING"} />
        </div>
      ) : null}

      {finalProgress > 0 ? (
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>Assembling final cut</span>
            <span className="text-[var(--color-muted)]">{finalProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-[var(--color-surface)]">
            <div
              className="h-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${finalProgress}%` }}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
