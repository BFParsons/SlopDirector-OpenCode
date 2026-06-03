"use client";

import { withBase } from "@/lib/basePath";

export function VideoPlayer({
  assetId,
  durationS,
  fill = false,
}: {
  assetId: string;
  durationS?: number | null;
  /** Fill the parent (object-contain) instead of sitting at natural width. */
  fill?: boolean;
}) {
  const src = withBase(`/api/assets/${assetId}`);

  if (fill) {
    return (
      <div className="flex h-full flex-col gap-1.5">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-black">
          <video src={src} controls className="max-h-full max-w-full" />
        </div>
        <div className="flex shrink-0 items-center justify-between text-[11px] text-[var(--color-muted)]">
          <span>{durationS ? `${durationS.toFixed(1)}s` : ""}</span>
          <a href={src} download className="text-[var(--color-accent)]">Download MP4</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <video
        src={src}
        controls
        className="w-full rounded-lg border border-[var(--color-border)] bg-black"
      />
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span>{durationS ? `${durationS.toFixed(1)}s` : ""}</span>
        <a href={src} download className="text-[var(--color-accent)]">Download MP4</a>
      </div>
    </div>
  );
}
