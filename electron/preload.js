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
});
