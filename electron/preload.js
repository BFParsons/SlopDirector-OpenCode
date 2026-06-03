// SlopStudio Pro — preload (runs in an isolated context with Node access, before
// the page loads). Exposes a minimal, safe surface to the renderer via the
// context bridge. Expanded later to replace the HTTP /api/assets round-trip with
// native filesystem reads and OS drag-in. For now it just lets the UI detect it
// is running inside the desktop shell.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("slopstudioDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
