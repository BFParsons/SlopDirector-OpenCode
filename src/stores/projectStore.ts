"use client";

import { create } from "zustand";
import type { ProjectSnapshot } from "@/lib/projects/serialize";
import { api, CLIENT_ID } from "@/lib/api";
import { withBase } from "@/lib/basePath";

interface ProgressEvent {
  type: string;
  [k: string]: unknown;
}

/** One MCP tool call as the agent lane shows it (start, then merged with its end). */
export interface ActivityItem {
  callId: string;
  tool: string;
  agent?: string;
  args?: Record<string, unknown>;
  summary?: string;
  ok?: boolean;
  ms?: number;
  phase: "start" | "end";
  at: number;
  projectId: string;
}
export type AgentFeedMode = "off" | "changes" | "full";

/** Tools that only look; "changes" mode hides them. */
const LOOK_TOOLS = /^(get_|detect_|transcribe$|probe_asset$|list_|search_|check_|pacing_report$|verify_export$|read_guide$|get_playbook$|render_status$|draft_result$|final_result$|compare_versions$|analyze_audio$|storyboard_sheet$|plan_document$|plan_tasks$)/;
export const isLookTool = (tool: string) => LOOK_TOOLS.test(tool);

const FEED_KEY = "slop.agentFeed";
const FOLLOW_KEY = "slop.agentFollow";
const readPref = <T,>(key: string, fallback: T): T => {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const writePref = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. */
  }
};

const CHANGE_FIELDS = ["index", "track", "trimStartS", "durationS", "speed", "muted", "volume", "offsetS", "audioOnly", "status"] as const;
/** Segments added or edited between two snapshots — what the agent lane flashes. */
function changedSegmentIds(prev: ProjectSnapshot | null, next: ProjectSnapshot): string[] {
  if (!prev) return [];
  const before = new Map(prev.segments.map((s) => [s.id, s]));
  const out: string[] = [];
  for (const s of next.segments) {
    const b = before.get(s.id);
    if (!b) {
      out.push(s.id);
      continue;
    }
    const a = s as unknown as Record<string, unknown>;
    const bb = b as unknown as Record<string, unknown>;
    if (CHANGE_FIELDS.some((k) => a[k] !== bb[k])) out.push(s.id);
  }
  return out;
}

interface ProjectState {
  snapshot: ProjectSnapshot | null;
  connected: boolean;
  assemblyPercent: number;
  /** the agent lane */
  activity: ActivityItem[];
  agentFeed: AgentFeedMode;
  follow: boolean;
  /** segment ids the agent just changed → expiry timestamp (ms) */
  flashIds: Record<string, number>;
  /** segments that appeared in the last refresh, in timeline order (revealed one by one) */
  arrivals: string[];
  /** the segment to follow (select + seek): the newest arrival, else the last change */
  lastChangedId: string | null;
  lastChangedAt: number;
  /** a draft that landed since the person last saw one (the monitor switches to it) */
  draftArrivedId: string | null;
  ackDraft: () => void;
  _es: EventSource | null;
  _poll: ReturnType<typeof setInterval> | null;
  _projectId: string | null;
  _refetchTimer: ReturnType<typeof setTimeout> | null;
  setSnapshot: (s: ProjectSnapshot | null) => void;
  refetch: () => Promise<void>;
  /** coalesce a burst of change events (an edit list fires one per op) into one refetch */
  refetchSoon: () => void;
  connect: (id: string) => void;
  disconnect: () => void;
  setAgentFeed: (m: AgentFeedMode) => void;
  setFollow: (on: boolean) => void;
  loadActivity: () => Promise<void>;
  clearActivity: () => void;
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
  activity: [],
  agentFeed: readPref<AgentFeedMode>(FEED_KEY, "full"),
  follow: readPref<boolean>(FOLLOW_KEY, true),
  flashIds: {},
  arrivals: [],
  lastChangedId: null,
  lastChangedAt: 0,
  draftArrivedId: null,
  ackDraft: () => set({ draftArrivedId: null }),
  _es: null,
  _poll: null,
  _projectId: null,
  _refetchTimer: null,

  setSnapshot: (s) => set({ snapshot: s }),

  refetch: async () => {
    const id = get()._projectId;
    if (!id) return;
    try {
      const snap = await api<ProjectSnapshot>(`/api/projects/${id}`);
      const prev = get().snapshot;
      const changed = get().agentFeed === "off" ? [] : changedSegmentIds(prev, snap);
      const flashIds = { ...get().flashIds };
      const now = Date.now();
      for (const k of Object.keys(flashIds)) if (flashIds[k] < now) delete flashIds[k];
      for (const cid of changed) flashIds[cid] = now + 2500;
      const before = new Set((prev?.segments ?? []).map((s) => s.id));
      const arrivals = changed.length ? segmentOrder(snap).filter((id) => changed.includes(id) && !before.has(id)) : [];
      const lastChangedId = arrivals[arrivals.length - 1] ?? changed[changed.length - 1] ?? null;
      const prevDraft = prev?.finalRender?.draftAssetId ?? null;
      const nextDraft = snap.finalRender?.draftAssetId ?? null;
      set({
        snapshot: snap,
        flashIds,
        arrivals,
        ...(lastChangedId ? { lastChangedId, lastChangedAt: now } : {}),
        ...(prev && nextDraft && nextDraft !== prevDraft && get().agentFeed !== "off" ? { draftArrivedId: nextDraft } : {}),
      });
      if (changed.length) setTimeout(() => {
        const cur = { ...get().flashIds };
        const t = Date.now();
        for (const k of Object.keys(cur)) if (cur[k] <= t) delete cur[k];
        set({ flashIds: cur });
      }, 2600);
    } catch {
      /* ignore transient errors */
    }
  },

  refetchSoon: () => {
    const t = get()._refetchTimer;
    if (t) clearTimeout(t);
    set({ _refetchTimer: setTimeout(() => {
      set({ _refetchTimer: null });
      void get().refetch();
    }, 150) });
  },

  setAgentFeed: (m) => {
    writePref(FEED_KEY, m);
    set({ agentFeed: m });
    if (m !== "off" && !get().activity.length) void get().loadActivity();
  },
  setFollow: (on) => {
    writePref(FOLLOW_KEY, on);
    set({ follow: on });
  },
  loadActivity: async () => {
    const id = get()._projectId;
    if (!id || get().agentFeed === "off") return;
    try {
      const r = await api<{ activity: ActivityItem[] }>(`/api/projects/${id}/activity?limit=150`);
      set({ activity: mergeActivity([], r.activity) });
    } catch {
      /* no feed */
    }
  },
  clearActivity: () => set({ activity: [] }),

  connect: (id) => {
    get().disconnect();
    const es = new EventSource(withBase(`/api/projects/${id}/events`));
    // Poll as the cross-process fallback (SSE only carries in-process events).
    const poll = setInterval(() => {
      if (isActive(get().snapshot)) void get().refetch();
    }, 2500);
    set({ _es: es, _poll: poll, _projectId: id, activity: [], flashIds: {} });
    void get().loadActivity();

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
    const { _es, _poll, _refetchTimer } = get();
    if (_es) _es.close();
    if (_poll) clearInterval(_poll);
    if (_refetchTimer) clearTimeout(_refetchTimer);
    set({ _es: null, _poll: null, _refetchTimer: null, connected: false });
  },
}));

/** Timeline order: main-sequence shots by index, then positioned clips by offset. */
function segmentOrder(snap: ProjectSnapshot): string[] {
  const main = snap.segments.filter((s) => (s.track ?? 0) === 0 && !s.audioOnly && !s.library).sort((a, b) => a.index - b.index);
  const rest = snap.segments.filter((s) => !main.includes(s)).sort((a, b) => (a.offsetS ?? 0) - (b.offsetS ?? 0));
  return [...main, ...rest].map((s) => s.id);
}

/** Timeline start of a segment (seconds): cumulative for the main sequence, offsetS otherwise. */
export function segmentStartS(snap: ProjectSnapshot, id: string): number | null {
  const s = snap.segments.find((x) => x.id === id);
  if (!s) return null;
  if ((s.track ?? 0) !== 0 || s.audioOnly) return s.offsetS ?? 0;
  let t = 0;
  for (const m of snap.segments.filter((x) => (x.track ?? 0) === 0 && !x.audioOnly && !x.library).sort((a, b) => a.index - b.index)) {
    if (m.id === id) return t;
    t += m.durationS;
  }
  return null;
}

const MAX_ACTIVITY = 200;
/** Merge events by callId (an end event completes its start), newest last. */
function mergeActivity(list: ActivityItem[], incoming: ActivityItem[]): ActivityItem[] {
  const out = [...list];
  for (const ev of incoming) {
    const i = out.findIndex((x) => x.callId === ev.callId);
    if (i >= 0) out[i] = { ...out[i], ...ev, args: ev.args ?? out[i].args };
    else out.push(ev);
  }
  return out.length > MAX_ACTIVITY ? out.slice(out.length - MAX_ACTIVITY) : out;
}

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
      // Coalesced: an agent's edit list fires one event per operation.
      if (event.clientId && event.clientId === CLIENT_ID) return;
      get().refetchSoon();
      return;
    case "agent.activity": {
      if (get().agentFeed === "off") return;
      const ev = event as unknown as ActivityItem;
      set({ activity: mergeActivity(get().activity, [ev]) });
      return;
    }

    default:
      return;
  }
}
