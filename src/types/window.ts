import type { PanelType } from "./panel";

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowState {
  id: string;
  panelType: PanelType;
  title: string;
  position: WindowPosition;
  size: WindowSize;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  preMaximizeState?: {
    position: WindowPosition;
    size: WindowSize;
  };
}

export interface WorkspaceLayoutData {
  version: 2;
  windows: WindowState[];
  nextZIndex: number;
  /** Workspace (container) size this layout was authored at. When present, a
   *  layout opened on a different-sized display is scaled proportionally
   *  before being clamped to fit (see `fitLayoutToContainer`). Absent on
   *  legacy saves, which are only clamped. */
  container?: WindowSize;
}
