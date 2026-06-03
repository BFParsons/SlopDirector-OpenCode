"use client";

import { PerfHud } from "@/components/perf/PerfHud";
import type { ProjectSnapshot } from "@/lib/projects/serialize";
import { ProjectEditorProvider } from "./ProjectEditorProvider";
import WorkspaceShell from "./WorkspaceShell";

/** The panel Studio for one project: the per-project edit context wrapping the
 *  floating-window workspace. Keyed on snapshot.updatedAt by the caller so a
 *  fresh server state re-seeds the draft (the global layout store survives). */
export function StudioRoot({
  snapshot,
  refetch,
  isAdmin,
  userEmail,
  initialPreset,
}: {
  snapshot: ProjectSnapshot;
  refetch: () => Promise<void>;
  isAdmin: boolean;
  userEmail: string;
  /** Optional workspace preset to apply on open (e.g. "audio-studio"). */
  initialPreset?: string;
}) {
  return (
    <ProjectEditorProvider snapshot={snapshot} refetch={refetch} isAdmin={isAdmin} userEmail={userEmail}>
      <WorkspaceShell initialPreset={initialPreset} />
      <PerfHud />
    </ProjectEditorProvider>
  );
}
