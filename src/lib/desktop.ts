"use client";

/**
 * Typed access to the Electron desktop bridge (exposed in electron/preload.js).
 * Returns null in the web build, so callers can feature-detect desktop-only
 * capabilities like the native folder picker.
 */
export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  versions: { electron: string; chrome: string; node: string };
  /** Native folder picker. Resolves to an absolute path, or null if cancelled. */
  pickFolder: (opts?: { title?: string; defaultPath?: string }) => Promise<string | null>;
  /** Reveal a file/folder in the OS file manager. */
  reveal: (target: string) => Promise<boolean>;
}

declare global {
  interface Window {
    slopstudioDesktop?: DesktopBridge;
  }
}

export function desktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.slopstudioDesktop ?? null;
}

export function isDesktop(): boolean {
  return desktop() != null;
}
