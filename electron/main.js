// SlopStudio Pro — Electron main process.
//
// Two modes:
//   • dev  (ELECTRON_DEV=1): the Next dev server is already running on :3000
//     (started by `pnpm desktop:dev`); we just open a window onto it.
//   • prod (packaged): spawn the Next *standalone* server
//     (.next/standalone/server.js — next.config emits `output: "standalone"`)
//     as a child process bound to localhost, with the job worker enabled in the
//     same process, an embedded SQLite DB + assets under the OS user-data dir,
//     and the bundled ffmpeg on the path. Then open a window onto it.
//
// NOTE: the prod packaging path (SQLite client + bundled ffmpeg/prisma engines)
// is scaffolded but not yet fully wired — see docs/DESKTOP.md. The dev path runs
// today.

const { app, BrowserWindow, shell, ipcMain, dialog, screen } = require("electron");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const DEV = process.env.ELECTRON_DEV === "1";

// Linux GPU video decode: checked on 2026-09-08 with Electron 44 (Chromium 152)
// on Hyprland/Wayland + Intel UHD 620 — `app.getGPUFeatureStatus().video_decode`
// is already "enabled" by default (VA-API), so no `enable-features` switches
// are needed. If a future Electron regresses this, the switches to try are
// VaapiVideoDecodeLinuxGL + AcceleratedVideoDecodeLinuxGL (before app.ready).
const HOST = "127.0.0.1";
const PORT = Number(process.env.SLOPSTUDIO_PORT || 38473);
const DEV_URL = "http://localhost:3000";
const PROD_URL = `http://${HOST}:${PORT}`;

let serverProc = null;
let mainWindow = null;

/**
 * Resolve the bundled standalone server + DDL. Packaged: under
 * process.resourcesPath (electron-builder extraResources). Dev: the build
 * outputs in the project tree.
 */
function bundlePaths() {
  if (app.isPackaged) {
    const res = process.resourcesPath;
    return {
      serverEntry: path.join(res, "standalone", "server.js"),
      cwd: path.join(res, "standalone"),
      ddl: path.join(res, "desktop-schema.sql"),
    };
  }
  const root = path.join(__dirname, "..");
  return {
    serverEntry: path.join(root, ".next", "standalone", "server.js"),
    cwd: path.join(root, ".next", "standalone"),
    ddl: path.join(root, "prisma", "desktop-schema.sql"),
  };
}

/** A stable per-install session secret, generated once and persisted. */
function authSecret(userData) {
  const file = path.join(userData, "auth-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const secret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

function startServer() {
  const { serverEntry, cwd, ddl } = bundlePaths();
  const userData = app.getPath("userData");

  // Point the ffmpeg resolver at a bundled binary ONLY if it actually exists;
  // otherwise leave SLOPSTUDIO_FFMPEG_DIR unset so the resolver falls back to the
  // system ffmpeg on PATH. (We don't bundle ffmpeg yet, so this is the live path.)
  const bundledFfmpegDir =
    process.env.SLOPSTUDIO_FFMPEG_DIR || path.join(process.resourcesPath || "", "ffmpeg");
  const ffmpegEnv = fs.existsSync(path.join(bundledFfmpegDir, "ffmpeg"))
    ? { SLOPSTUDIO_FFMPEG_DIR: bundledFfmpegDir }
    : {};

  serverProc = spawn(process.execPath, [serverEntry], {
    stdio: "inherit",
    cwd,
    env: {
      ...process.env,
      // Run server.js as plain Node using Electron's bundled runtime.
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: HOST,
      PORT: String(PORT),
      // Worker runs in-process (src/instrumentation.ts) — one process, offline.
      WORKER_ENABLED: "true",
      // Single local user — skip the login screen (see lib/auth/session.ts).
      SLOPSTUDIO_DESKTOP: "1",
      // Embedded, per-user, offline data + SQLite-shaped encodings.
      SLOPSTUDIO_DB: "sqlite",
      DATABASE_URL:
        process.env.DATABASE_URL || `file:${path.join(userData, "slopstudio.db")}`,
      SLOPSTUDIO_SCHEMA_SQL: ddl, // first-launch DDL (src/lib/db/bootstrap.ts)
      ASSET_ROOT: process.env.ASSET_ROOT || path.join(userData, "assets"),
      // Per-install session secret (auth needs it; generated on first launch).
      AUTH_SECRET: process.env.AUTH_SECRET || authSecret(userData),
      // Bundled ffmpeg/ffprobe dir, set only when actually present (see above);
      // otherwise omitted so the resolver uses the system ffmpeg on PATH.
      ...ffmpegEnv,
    },
  });

  serverProc.on("exit", (code) =>
    console.error(`[slopstudio-pro] server exited with code ${code}`),
  );
}

/** Poll the server until it answers (any HTTP response counts as "up"). */
function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("server did not start in time"));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

async function createWindow() {
  // Fit the display: the design size is 1480x900, but a HiDPI laptop at 2x
  // scale can have a logical work area as small as ~960x540. Never ask for a
  // window larger than what the screen can actually show.
  //
  // Keep the MINIMUM small. On Wayland tiling compositors (Hyprland) the tile
  // can be smaller than any minimum we declare; Chromium then renders at the
  // minimum anyway and the compositor crops the surface, so the bottom/right
  // of the UI is simply cut off. The web UI is responsive down to small
  // viewports (see /start), so let the window manager own the size.
  const { workAreaSize } = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: Math.min(1480, workAreaSize.width),
    height: Math.min(900, workAreaSize.height),
    minWidth: 480,
    minHeight: 320,
    backgroundColor: "#0b0e14",
    autoHideMenuBar: true,
    title: "SlopStudio Pro",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open target=_blank / external links in the real browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // The editor installs a `beforeunload` guard (useLeaveGuard) for unsaved /
  // unnamed projects. A browser shows a "Leave site?" prompt for that; Electron
  // shows NOTHING and silently cancels the reload / navigation / window close
  // unless the app handles `will-prevent-unload`.
  //
  // We deliberately do NOT use a native modal here (dialog.showMessageBoxSync):
  // it blocks the main process, and on Wayland tiling compositors (Hyprland) the
  // modal can land on another workspace and be impossible to dismiss. Instead
  // the page is kept (no preventDefault) and told to show its own save/discard
  // dialog; once resolved it asks us to finish the close/reload (slop:unload-action)
  // with its guard bypassed.
  let closing = false;
  mainWindow.on("close", () => {
    closing = true; // beforeunload runs after this; if it blocks, we learn the kind
    setTimeout(() => (closing = false), 1000);
  });
  mainWindow.webContents.on("will-prevent-unload", () => {
    const kind = closing ? "close" : "reload";
    closing = false;
    mainWindow.webContents.send("slop:unload-blocked", { kind });
  });

  const url = DEV ? DEV_URL : PROD_URL;
  // Something on screen at once: the embedded server takes a couple of seconds
  // to boot, and a blank dark window reads as "hung".
  mainWindow.loadFile(path.join(__dirname, "splash.html")).catch(() => {});
  if (!DEV) startServer();
  await waitForServer(url).catch((e) => console.error(e));
  await mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// The page finished its save/discard flow for a blocked unload: do what the
// user originally asked for (see will-prevent-unload above).
ipcMain.handle("slop:unload-action", (_evt, kind) => {
  if (!mainWindow) return false;
  if (kind === "close") mainWindow.close();
  else mainWindow.webContents.reload();
  return true;
});

// Native "choose a folder" dialog for project-save locations. Returns the
// selected absolute path, or null if the user cancels.
ipcMain.handle("slop:pick-folder", async (_evt, opts) => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  const res = await dialog.showOpenDialog(win, {
    title: (opts && opts.title) || "Choose a folder",
    defaultPath: (opts && opts.defaultPath) || app.getPath("documents"),
    properties: ["openDirectory", "createDirectory"],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

// Reveal a path in the OS file manager (Explorer/Finder).
ipcMain.handle("slop:reveal", async (_evt, target) => {
  if (typeof target === "string" && target) shell.showItemInFolder(target);
  return true;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("quit", () => {
  if (serverProc) serverProc.kill();
});
