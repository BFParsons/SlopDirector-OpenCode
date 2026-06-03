# Portable Project Bundles

A project can be saved as a **self-contained folder** under a location you choose —
a named folder holding a portable `project.json` manifest plus an `assets/` tree.
This is the Premiere/DaVinci "project bundle" model: copy the folder to another
drive or machine to back it up or move it.

> Status: **save side complete** (new projects materialize as bundles; assets +
> final render land inside; the manifest is written on every save). The
> *open-a-moved-bundle* round-trip (reconstructing a fresh DB from a folder) is
> the remaining piece — see [Roadmap](#roadmap).

## Folder layout

```
<BaseFolder>/<Project Name>/
  project.json          ← the portable manifest (settings + timeline + segments)
  assets/
    uploads/  clips/  vo/  overlays/  final/  images/  tmp/
```

`project.json` is `{ manifestVersion, project }`, where `project` is the same
serialized snapshot the editor loads (`src/lib/projects/serialize.ts`). It is
rewritten on project create and on every save (`PATCH /api/projects/[id]`).

## Data model

The SQLite/Postgres DB still backs the app's queries and the render pipeline; it
now **indexes** bundles rather than being the only store.

- `Project.bundlePath` — absolute path to the project's bundle folder.
  `null` = a **legacy** project stored under `ASSET_ROOT/<projectId>` (unchanged).
- `User.defaultProjectFolder` — the base folder new bundles are created under.

Both columns exist in `prisma/schema.prisma`, `prisma/schema.sqlite.prisma`, the
fresh-install DDL (`prisma/desktop-schema.sql`), and an idempotent in-place
`ALTER TABLE` in `src/lib/db/bootstrap.ts`.

## Path resolution (the key trick)

Bundle projects store **absolute** asset paths (their files live in the user's
folder); legacy projects keep paths **relative to `ASSET_ROOT`**. So the ~23
read sites that call `absolutePath(asset.path)` keep working unchanged:

```ts
// src/lib/assets/storage.ts
export function absolutePath(p: string): string {
  if (path.isAbsolute(p)) return path.normalize(p);      // bundle asset → pass through
  const abs = path.resolve(ASSET_ROOT, p);               // legacy → resolve + guard
  if (abs !== ASSET_ROOT && !abs.startsWith(ASSET_ROOT + path.sep))
    throw new Error("Asset path escapes ASSET_ROOT");
  return abs;
}
```

Only the **write** side is bundle-aware. `projectAssetDir(projectId, sub)` looks up
`bundlePath` and returns `<bundle>/assets/<sub>` (absolute paths) or
`ASSET_ROOT/<projectId>/<sub>` (relative). All writers (`saveAsset`,
`writeAssetFile`, `writeAssetStream`, `saveAssetStream`, `copyAssetToProject`) and
the final-render output (`src/lib/jobs/handlers.ts`) route through it.

## Choosing where projects go (desktop)

The native folder picker is exposed by Electron:

- `electron/main.js` — `ipcMain.handle("slop:pick-folder")` →
  `dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })`,
  plus `slop:reveal` to show a path in the OS file manager.
- `electron/preload.js` — bridges `window.slopstudioDesktop.pickFolder()` / `reveal()`.
- `src/lib/desktop.ts` — typed `desktop()` accessor; returns `null` in the web build
  (no local filesystem), so UI feature-detects desktop-only behaviour.

**Settings → Default project folder** (`src/components/ProjectFolderSettings.tsx`,
`POST/DELETE /api/account/project-folder`) sets `User.defaultProjectFolder`.

**New project flow:** `POST /api/projects` resolves a base folder from
`body.bundleBase` (per-project override picked in the New Project popup) or the
user's default. If a base exists it calls `createProjectBundle(base, title)`
(`src/lib/projects/bundle.ts`) — a unique, filesystem-safe named folder — sets
`bundlePath`, and seeds `project.json`.

## Roadmap

- **Open from folder** — pick a bundle folder, read `project.json`, and upsert the
  full project graph (segments, overlays, assets, story elements, …) into the DB,
  so a moved/copied bundle can be re-opened on a fresh install.
- Extend the per-project save-folder override beyond the Assembly card (Storyboard /
  Audio Studio / Brief currently use the default folder).
- Move Audio Studio scratch (`audio-studio/<projectId>`) into the bundle (currently
  ephemeral, under `ASSET_ROOT`; assets promoted via *to-asset* already go in the bundle).
