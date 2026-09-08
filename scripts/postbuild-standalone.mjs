#!/usr/bin/env node
/*
 * After `next build` (output: "standalone"), Next does NOT copy the static
 * assets or the public/ dir into the standalone bundle — you must do it so the
 * self-contained server can serve them.
 *
 * It has ALSO historically missed some dynamically-loaded next-server runtime
 * files (e.g. app-route-turbo.runtime.prod.js), so API route handlers threw
 * "Cannot find module …" at runtime. We backfill any *missing* runtime files
 * from the installed `next` package.
 *
 * IMPORTANT: the backfill must come from the SAME `next` version the build
 * used, and must never overwrite files that tracing already placed. An earlier
 * version of this script grabbed the first `next@*` entry in the pnpm store
 * (a stale older release) and clobbered the traced runtime — the route module
 * then loaded under a mismatched runtime with an empty handler map and every
 * API route answered 405 Method Not Allowed.
 */
import { cpSync, existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const root = process.cwd();
const sa = join(root, ".next", "standalone");
if (!existsSync(join(sa, "server.js"))) {
  console.error("No .next/standalone/server.js — did `next build` run with output:'standalone'?");
  process.exit(1);
}

cpSync(join(root, ".next", "static"), join(sa, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(sa, "public"), { recursive: true });
}

// The `next` package this project actually resolves (follows pnpm symlinks).
const require = createRequire(join(root, "package.json"));
const srcPkg = dirname(realpathSync(require.resolve("next/package.json")));
// The `next` package inside the standalone bundle (a symlink into its own .pnpm store).
const dstLink = join(sa, "node_modules", "next");
const dstPkg = existsSync(dstLink) ? realpathSync(dstLink) : null;

const version = (dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;

if (dstPkg && version(srcPkg) === version(dstPkg)) {
  const src = join(srcPkg, "dist", "compiled", "next-server");
  const dst = join(dstPkg, "dist", "compiled", "next-server");
  // force:false — only add files tracing missed; never replace traced ones.
  cpSync(src, dst, { recursive: true, force: false, errorOnExist: false });
  console.log(`staged: .next/static + public + next-server runtime (next@${version(srcPkg)}) into .next/standalone`);
} else {
  console.log(
    `staged: .next/static + public (runtime backfill skipped: project next@${version(srcPkg)}, standalone ${dstPkg ? "next@" + version(dstPkg) : "missing"})`,
  );
}
