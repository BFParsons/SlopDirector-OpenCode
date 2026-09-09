import type { ComponentType } from "react";

/** Single source of truth for all Studio panel types.
 *  Add new panels here — the layout API validation derives from this array. */
export const PANEL_TYPES = [
  "monitor",
  "video-edit",
  "video-gen",
  "voiceover",
  "timeline",
  "visual",
  "effect-controls",
  "audio",
  "audio-mixer",
  "polish",
  "text-overlays",
  "agent", // the agent lane: what an MCP agent is doing, live
  // Audio Studio panels (the dedicated audio workspace).
  "audio-multitrack",
  "audio-visualizer",
  "audio-importer",
  "stem-separation",
  "audio-processing",
  "loudness-meter",
  "audio-tools",
  // Future panels (registry stubs for now):
  "media-bucket",
  "youtube-importer",
] as const;

export type PanelType = (typeof PANEL_TYPES)[number];

export type PanelGroup = "Viewer" | "Edit" | "Audio" | "Finish" | "Library";

export interface WindowControls {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
}

/** Panels read the open project's edit state from {@link useProjectEditor},
 *  not from props — so PanelProps only carries window chrome wiring. */
export interface PanelProps {
  panelId: string;
  windowControls?: WindowControls;
  isMinimized?: boolean;
}

export interface PanelRegistryEntry {
  type: PanelType;
  title: string;
  icon: string;
  group: PanelGroup;
  component: ComponentType<PanelProps>;
  minWidth?: number;
  minHeight?: number;
}
