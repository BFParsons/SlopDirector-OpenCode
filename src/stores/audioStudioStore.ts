"use client";

/**
 * Shared client state for the Audio Studio panels. Tracks live here so the
 * Importer, Multitrack timeline, Visualizer, Mixer, Stem Separation, Processing
 * Rack, Loudness Meter and Tools panels all see the same set of audio clips and
 * can hand work off to each other (import → separate → process → mix).
 *
 * This is purely in-browser session state — the audio bytes live server-side
 * under the project's audio-studio folder (see lib/audio/workspace.ts). Nothing
 * here auto-persists; it matches the Studio's "no auto-save" rule.
 */
import { create } from "zustand";

export type TrackKind = "import" | "stem" | "processed" | "mix" | "render";

export interface AudioTrack {
  id: string;
  name: string;
  /** Portable relative path on the server (audio-studio/<pid>/<file>). */
  relPath: string;
  /** Auth-gated stream URL for <audio> / WaveSurfer. */
  url: string;
  /** Visible/effective clip length on the timeline, seconds (after trimming). */
  durationS: number;
  /** Full length of the underlying source file — the trim ceiling. */
  sourceDurationS: number;
  /** In-point within the source, seconds (left trim). */
  trimStartS: number;
  kind: TrackKind;
  color: string;
  muted: boolean;
  solo: boolean;
  /** 0..1.5 linear gain applied in the in-browser mix. */
  volume: number;
  /** Start offset on the multitrack timeline, in seconds. */
  offsetS: number;
  /** Detected tempo (BPM) and beat times (seconds, in source time), if measured. */
  bpm?: number | null;
  beats?: number[];
}

let trackSeq = 0;
function nextId(): string {
  trackSeq += 1;
  return `atrk-${trackSeq}-${Math.round(performance.now())}`;
}

// Lane colors cycle through the palette so adjacent tracks stay distinct.
// Muted, desaturated palette — calmer waveform lanes (rendered semi-transparent
// with a soft glow in the Multitrack panel).
const PALETTE = ["#8089a8", "#7a9d8a", "#b8a878", "#bf8f88", "#9b90b5", "#7ea3aa", "#b591a6", "#94ad8c"];

export interface NewTrackInput {
  name: string;
  relPath: string;
  url: string;
  durationS: number;
  sourceDurationS?: number;
  trimStartS?: number;
  kind?: TrackKind;
  offsetS?: number;
}

/** A persisted multitrack track (the editable session), id assigned on load. */
export type SessionTrack = Omit<AudioTrack, "id"> & { id?: string };

interface AudioStudioState {
  projectId: string | null;
  tracks: AudioTrack[];
  selectedTrackId: string | null;
  /** Master transport position (seconds) shared by panels. */
  playheadS: number;
  isPlaying: boolean;

  setProject: (id: string) => void;
  addTrack: (t: NewTrackInput) => AudioTrack;
  addTracks: (ts: NewTrackInput[]) => AudioTrack[];
  /** Replace all tracks from a persisted session (rehydrate the multitrack). */
  setTracks: (ts: SessionTrack[]) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<AudioTrack>) => void;
  /** Split a track at a timeline position into two adjacent clips. */
  splitTrack: (id: string, atTimelineS: number) => void;
  select: (id: string | null) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  setPlayhead: (s: number) => void;
  setPlaying: (p: boolean) => void;
  /** Longest (offset + duration) across tracks — the timeline length. */
  totalDurationS: () => number;
  selectedTrack: () => AudioTrack | null;
}

export const useAudioStudioStore = create<AudioStudioState>((set, get) => ({
  projectId: null,
  tracks: [],
  selectedTrackId: null,
  playheadS: 0,
  isPlaying: false,

  setProject: (id) =>
    set((s) => (s.projectId === id ? s : { projectId: id, tracks: [], selectedTrackId: null, playheadS: 0, isPlaying: false })),

  addTrack: (t) => {
    const track: AudioTrack = {
      id: nextId(),
      name: t.name,
      relPath: t.relPath,
      url: t.url,
      durationS: t.durationS,
      sourceDurationS: t.sourceDurationS ?? t.durationS,
      trimStartS: t.trimStartS ?? 0,
      kind: t.kind ?? "import",
      color: PALETTE[get().tracks.length % PALETTE.length],
      muted: false,
      solo: false,
      volume: 1,
      offsetS: t.offsetS ?? 0,
    };
    set((s) => ({ tracks: [...s.tracks, track], selectedTrackId: track.id }));
    return track;
  },

  addTracks: (ts) => {
    const created = ts.map((t, i) => ({
      id: nextId(),
      name: t.name,
      relPath: t.relPath,
      url: t.url,
      durationS: t.durationS,
      sourceDurationS: t.sourceDurationS ?? t.durationS,
      trimStartS: t.trimStartS ?? 0,
      kind: t.kind ?? "import",
      color: PALETTE[(get().tracks.length + i) % PALETTE.length],
      muted: false,
      solo: false,
      volume: 1,
      offsetS: t.offsetS ?? 0,
    }));
    set((s) => ({ tracks: [...s.tracks, ...created], selectedTrackId: created[0]?.id ?? s.selectedTrackId }));
    return created;
  },

  setTracks: (ts) =>
    set(() => ({
      tracks: ts.map((t, i) => ({
        id: nextId(),
        name: t.name,
        relPath: t.relPath,
        url: t.url,
        durationS: t.durationS,
        sourceDurationS: t.sourceDurationS ?? t.durationS,
        trimStartS: t.trimStartS ?? 0,
        kind: t.kind ?? "import",
        color: t.color ?? PALETTE[i % PALETTE.length],
        muted: t.muted ?? false,
        solo: t.solo ?? false,
        volume: t.volume ?? 1,
        offsetS: t.offsetS ?? 0,
        bpm: t.bpm ?? null,
        beats: t.beats,
      })),
      selectedTrackId: null,
    })),

  removeTrack: (id) =>
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      selectedTrackId: s.selectedTrackId === id ? null : s.selectedTrackId,
    })),

  updateTrack: (id, patch) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  splitTrack: (id, atTimelineS) =>
    set((s) => {
      const idx = s.tracks.findIndex((t) => t.id === id);
      if (idx === -1) return {};
      const t = s.tracks[idx];
      const local = atTimelineS - t.offsetS; // position within the clip
      if (local <= 0.05 || local >= t.durationS - 0.05) return {}; // nothing to split
      const left: AudioTrack = { ...t, durationS: local };
      const right: AudioTrack = {
        ...t,
        id: nextId(),
        trimStartS: t.trimStartS + local,
        durationS: t.durationS - local,
        offsetS: t.offsetS + local,
      };
      const tracks = [...s.tracks];
      tracks.splice(idx, 1, left, right);
      return { tracks, selectedTrackId: left.id };
    }),

  select: (id) => set({ selectedTrackId: id }),

  toggleMute: (id) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)) })),

  toggleSolo: (id) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t)) })),

  setPlayhead: (s) => set({ playheadS: Math.max(0, s) }),
  setPlaying: (p) => set({ isPlaying: p }),

  totalDurationS: () => {
    const { tracks } = get();
    return tracks.reduce((m, t) => Math.max(m, t.offsetS + t.durationS), 0);
  },

  selectedTrack: () => {
    const { tracks, selectedTrackId } = get();
    return tracks.find((t) => t.id === selectedTrackId) ?? null;
  },
}));
