"use client";

import { create } from "zustand";
import type { ProjectSnapshot } from "@/lib/projects/serialize";
import { api, CLIENT_ID } from "@/lib/api";
import { withBase } from "@/lib/basePath";

interface ProgressEvent {
  type: string;
  [k: string]: unknown;
}

interface ProjectState {
  snapshot: ProjectSnapshot | null;
  connected: boolean;
  assemblyPercent: number;
  _es: EventSource | null;
  _poll: ReturnType<typeof setInterval> | null;
  _projectId: string | null;
  setSnapshot: (s: ProjectSnapshot | null) => void;
  refetch: () => Promise<void>;
  connect: (id: string) => void;
  disconnect: () => void;
}

// Whether the project is doing background work we should poll for. The worker
// runs in a SEPARATE process from the Next server, so its in-process SSE bus
// can't reach this client — polling is the reliable cross-process signal.
function isActive(s: ProjectSnapshot | null): boolean {
  if (!s) return false;
  return (
    s.status === "RENDERING" ||
    s.visualGenStatus === "RUNNING" ||
    s.scriptGenStatus === "RUNNING" ||
    // A standalone AI clip generation (Video Generator panel) runs in DRAFT —
    // poll until the shot is READY or FAILED.
    s.segments.some(
      (seg) =>
        (seg.source === "AI_GENERATED" || seg.source === "UPLOAD_IMAGE_DRIVER") &&
        seg.status !== "READY" &&
        seg.status !== "FAILED",
    ) ||
    // A YouTube import runs in DRAFT — poll until it produces its file or fails.
    s.segments.some((seg) => seg.importUrl && !seg.sourceAssetId && seg.status !== "FAILED") ||
    // An audio overlay download also runs in DRAFT — poll until READY or FAILED.
    s.audioOverlays.some((o) => o.status !== "READY" && o.status !== "FAILED")
  );
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  snapshot: null,
  connected: false,
  assemblyPercent: 0,
  _es: null,
  _poll: null,
  _projectId: null,

  setSnapshot: (s) => set({ snapshot: s }),

  refetch: async () => {
    const id = get()._projectId;
    if (!id) return;
    try {
      const snap = await api<ProjectSnapshot>(`/api/projects/${id}`);
      set({ snapshot: snap });
    } catch {
      /* ignore transient errors */
    }
  },

  connect: (id) => {
    get().disconnect();
    const es = new EventSource(withBase(`/api/projects/${id}/events`));
    // Poll as the cross-process fallback (SSE only carries in-process events).
    const poll = setInterval(() => {
      if (isActive(get().snapshot)) void get().refetch();
    }, 2500);
    set({ _es: es, _poll: poll, _projectId: id });

    es.onopen = () => set({ connected: true });
    es.onerror = () => {
      set({ connected: false });
      void get().refetch();
    };
    es.onmessage = (msg) => {
      let event: ProgressEvent;
      try {
        event = JSON.parse(msg.data);
      } catch {
        return;
      }
      reduce(event, set, get);
    };
  },

  disconnect: () => {
    const { _es, _poll } = get();
    if (_es) _es.close();
    if (_poll) clearInterval(_poll);
    set({ _es: null, _poll: null, connected: false });
  },
}));

function reduce(
  event: ProgressEvent,
  set: (partial: Partial<ProjectState>) => void,
  get: () => ProjectState,
) {
  const snap = get().snapshot;

  switch (event.type) {
    case "snapshot":
      set({ snapshot: (event.project as ProjectSnapshot) ?? null });
      return;

    case "project.status":
    case "visual.gen":
    case "script.gen":
    case "final.ready":
      // These imply new rows / regenerated content — resync the full snapshot.
      void get().refetch();
      return;

    case "segment.status": {
      if (!snap) return;
      const segments = snap.segments.map((s) =>
        s.id === event.segmentId
          ? {
              ...s,
              status: String(event.status) as typeof s.status,
              error: (event.error as string) ?? null,
            }
          : s,
      );
      set({ snapshot: { ...snap, segments } });
      return;
    }

    case "vo.status": {
      if (!snap || !snap.voiceover) {
        void get().refetch();
        return;
      }
      set({
        snapshot: {
          ...snap,
          voiceover: {
            ...snap.voiceover,
            status: String(event.status) as typeof snap.voiceover.status,
            error: (event.error as string) ?? null,
          },
        },
      });
      return;
    }

    case "assembly.progress":
      set({ assemblyPercent: Number(event.percent) || 0 });
      return;
    case "draft.ready":
      // A low-res preview finished — the snapshot carries its asset id.
      void get().refetch();
      return;
    case "project.changed":
      // Someone else (another window, an agent over the API) edited the
      // project; our own edits echo back with our CLIENT_ID and are skipped.
      if (event.clientId && event.clientId === CLIENT_ID) return;
      void get().refetch();
      return;

    default:
      return;
  }
}
