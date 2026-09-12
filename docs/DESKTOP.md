# SlopStudio Pro — desktop build

For native Windows launch, NSIS packaging and Codex editing, see
[WINDOWS-CODEX.md](WINDOWS-CODEX.md). The Linux architecture below also applies
to Windows, using `.exe` media tools and the platform Prisma query engine.

SlopStudio Pro is the **desktop fork** of SlopStudio. The web app (the original
repo) stays as-is; Pro diverges toward a packaged, offline, high-performance NLE.
This document describes the desktop target and what is / isn't wired yet.

## What "desktop" means here

The UI is the same web app, but instead of running in a browser tab at
`localhost` it runs inside **Electron**: a bundled Chromium renderer + a bundled
Node runtime, shipped as a single Linux **AppImage** (double-click, no install,
no root). The user sees a normal application window, not a browser.

Under the hood the packaged app is:

```
Electron main (electron/main.js)
  ├─ spawns the Next standalone server (.next/standalone/server.js) on 127.0.0.1
  │    ├─ WORKER_ENABLED=true  → job worker runs in the same process
  │    ├─ DATABASE_URL=file:…  → embedded SQLite under the OS user-data dir
  │    ├─ ASSET_ROOT=…/assets  → media lives under the user-data dir
  │    └─ SLOPSTUDIO_FFMPEG_DIR → bundled ffmpeg/ffprobe
  └─ opens a BrowserWindow onto http://127.0.0.1:<port>
```

Everything is offline **except AI generation** (Veo / Kling / Seedance / TTS),
which calls cloud APIs and needs a network + keys. The *editor* — timeline,
preview, export — is fully offline.

## Status

| Piece | State |
|-------|-------|
| Electron shell (`electron/main.js`, `preload.js`) | ✅ scaffolded; `pnpm desktop:dev` opens the app in a window over the dev server |
| ffmpeg resolver (`src/lib/ffmpeg/binary.ts`) | ✅ wired into `probe.ts` + `assemble.ts`; reads `SLOPSTUDIO_FFMPEG_DIR` |
| Standalone-server prod boot | ✅ `next.config.ts` already emits `output: "standalone"`; main.js spawns it |
| SQLite schema (`prisma/schema.sqlite.prisma`) | ⚠️ derived by `pnpm db:sqlite:derive`; **not yet used by the app** |
| electron-builder AppImage config | ⚠️ starting config in `package.json#build`; needs ffmpeg + engine bundling iteration |

## Dev loop

```bash
pnpm install            # installs electron, electron-builder, concurrently, wait-on
pnpm desktop:dev        # runs `next dev` + opens an Electron window onto it
```

This is the real, runnable path today. It uses the existing Postgres dev DB on
`:5434` (nothing about the dev loop is offline yet — that's the SQLite milestone).

## The remaining work (milestones)

### 1. Postgres → SQLite (the big one)

`pnpm db:sqlite:derive` generates `prisma/schema.sqlite.prisma` from the
canonical `schema.prisma`, applying the three SQLite incompatibilities:

1. **Enums → `String`.** SQLite has no native enums. Every enum-typed field
   becomes `String` (values preserved). **Consequence:** the generated SQLite
   client no longer exports enum *objects*, so app code that imports enum values
   from `@prisma/client` (`Role.ADMIN`, `AdStatus.DRAFT`, `ShotStatus.READY`, …)
   must be reconciled — e.g. move those unions/constants into a hand-written
   `src/lib/db/enums.ts` shared by both targets. This is the bulk of the effort.
2. **`String[]` → `String`.** SQLite has no scalar lists. `StoryElement.refImageIds`
   becomes a JSON-encoded `String` (`@default("[]")`); add encode/decode helpers
   at its read/write sites.
3. **Isolated client output.** The SQLite client generates to
   `src/generated/prisma-sqlite` so it never clobbers the web (Postgres) client.

Then: pick the client at runtime in `src/lib/db/client.ts` by build target (env),
generate fresh SQLite migrations, and seed a first admin on first launch.

### 2. Bundle ffmpeg

Ship a static `ffmpeg` + `ffprobe` per platform under `resources/ffmpeg` via
electron-builder `extraResources`; `main.js` already points
`SLOPSTUDIO_FFMPEG_DIR` at it. For the RTX 4060 target, build/ship an ffmpeg with
NVENC/NVDEC enabled.

### 3. Package the standalone server into the AppImage

`.next/standalone` carries its own traced `node_modules`, but the **Prisma query
engine** and **`@node-rs/argon2`** native binary must be present for the target
and survive electron-builder's packaging. Validate the produced AppImage end to
end (DB opens, asset serve works, an export runs).

### 4. Single-user simplifications

The desktop app is one local user — the argon2id multi-user session model can be
reduced to a local unlock (or dropped). Revisit auth, quotas, and the
admin-gated models accordingly.

## Why this is a fork, not a flag

Pro intentionally diverges (embedded DB, native file I/O, offline, packaging,
single-user) and targets a different audience than the web app. Performance work
on the preview engine (windowed `preload`, killing the keyed remount,
virtualization, WebCodecs) is architecture-level and lands here; it does not
depend on Electron and would also benefit the web app, but Pro is where it ships.
See `docs/SLOPSTUDIO.md` for the editor architecture and the perf plan.
