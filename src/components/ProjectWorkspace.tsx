"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { ProjectSnapshot } from "@/lib/projects/serialize";
import { api } from "@/lib/api";
import type { WorkspaceSection } from "@/config/studio-presets";
import { useExportStore } from "@/stores/exportStore";
import { useProjectStore } from "@/stores/projectStore";
import { Button, StatusBadge } from "@/components/ui";
import { ProgressTimeline } from "./ProgressTimeline";
import { SegmentCard, type SegmentView } from "./SegmentCard";
import { ExportWindow } from "./studio/ExportWindow";
import { StudioRoot } from "./studio/StudioRoot";

/**
 * Project view. While RENDERING, shows a full-screen progress view. Otherwise
 * (DRAFT / DONE / FAILED) shows the floating-panel Studio full-bleed.
 */
export function ProjectWorkspace({
  initial,
  isAdmin = false,
  userEmail = "",
  ws,
}: {
  initial: ProjectSnapshot;
  isAdmin?: boolean;
  userEmail?: string;
  ws?: string;
}) {
  const { snapshot, assemblyPercent, connect, disconnect, setSnapshot, refetch } =
    useProjectStore();
  const exportProjectId = useExportStore((s) => s.projectId);
  const closeExport = useExportStore((s) => s.close);

  // The `?ws=` launch param selects the suite: `audio-studio` → the Audio Editing
  // Suite, anything else → Video Assembly. Read server-side + passed down so it's
  // reliable across SSR and client navigation.
  const section: WorkspaceSection = ws === "audio-studio" ? "audio" : "video";

  useEffect(() => {
    setSnapshot(initial);
    connect(initial.id);
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  const snap = snapshot ?? initial;

  // The floating Export window overlays whichever view is shown (it outlives the
  // keyed StudioRoot remount because it's controlled by the module store here).
  const exportOverlay = exportProjectId ? (
    <ExportWindow
      projectId={exportProjectId}
      onClose={() => {
        closeExport();
        void refetch();
      }}
    />
  ) : null;

  // RENDERING: a focused, scrollable progress view (not panelized).
  if (snap.status === "RENDERING") {
    return (
      <>
        {exportOverlay}
        <div className="h-full overflow-auto">
        <div className="mx-auto w-full max-w-3xl space-y-5 p-6">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ← All videos
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{snap.title}</h1>
              {snap.subject ? (
                <p className="text-sm text-[var(--color-muted)]">{snap.subject}</p>
              ) : null}
            </div>
            <StatusBadge status={snap.status} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-muted)]">
              Rendering… retry a failed segment below, or cancel to edit. Completed shots
              are kept.
            </p>
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              onClick={async () => {
                await api(`/api/projects/${snap.id}/cancel`, { method: "POST", body: "{}" });
                await refetch();
              }}
            >
              Cancel render → edit
            </Button>
          </div>
          <ProgressTimeline snapshot={snap} assemblyPercent={assemblyPercent} />
          <div className="grid gap-3 sm:grid-cols-2">
            {snap.segments.map((s) => (
              <SegmentCard
                key={s.id}
                projectId={snap.id}
                segment={s as SegmentView}
                editable={false}
                onRetry={async () => {
                  await api(`/api/projects/${snap.id}/segments/${s.id}/retry`, {
                    method: "POST",
                    body: "{}",
                  });
                  await refetch();
                }}
              />
            ))}
          </div>
        </div>
        </div>
      </>
    );
  }

  // DRAFT / DONE / FAILED → the panel Studio (full-bleed). A failed render shows a
  // thin banner above the workspace so the error stays visible while you edit/retry.
  return (
    <>
      {exportOverlay}
      <div className="flex h-full flex-col">
        {snap.status === "FAILED" && snap.error ? (
          <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-danger)]/10 px-4 py-2 text-xs text-[var(--color-danger)]">
            Render failed: {snap.error}
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          {/* Keyed remount → fresh draft + engine whenever the server data changes. */}
          <StudioRoot
            key={String(snap.updatedAt)}
            snapshot={snap}
            refetch={refetch}
            isAdmin={isAdmin}
            userEmail={userEmail}
            section={section}
          />
        </div>
      </div>
    </>
  );
}
