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
}
