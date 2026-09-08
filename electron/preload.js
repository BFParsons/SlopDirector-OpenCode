// SlopStudio Pro — preload (runs in an isolated context with Node access, before
// the page loads). Exposes a minimal, safe surface to the renderer via the
// context bridge. Expanded later to replace the HTTP /api/assets round-trip with
// native filesystem reads and OS drag-in. For now it just lets the UI detect it
// is running inside the desktop shell.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("slopstudioDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  /** Open a native folder picker. Resolves to an absolute path, or null. */
  pickFolder: (opts) => ipcRenderer.invoke("slop:pick-folder", opts),
  /** Reveal a file/folder in the OS file manager. */
  reveal: (target) => ipcRenderer.invoke("slop:reveal", target),
  /**
   * A window close / reload was blocked by the page's beforeunload guard. The
   * page shows its own save/discard dialog, then calls finishUnload(kind).
   * Returns an unsubscribe function.
   */
  onUnloadBlocked: (cb) => {
    const handler = (_evt, payload) => cb(payload);
    ipcRenderer.on("slop:unload-blocked", handler);
    return () => ipcRenderer.removeListener("slop:unload-blocked", handler);
  },
  /** Finish a previously blocked close/reload (the page bypasses its guard first). */
  finishUnload: (kind) => ipcRenderer.invoke("slop:unload-action", kind),
});
