#!/usr/bin/env node
/*
 * After `next build` (output: "standalone"), Next does NOT copy the static
 * assets or the public/ dir into the standalone bundle — you must do it so the
 * self-contained server can serve them.
 *
 * It ALSO fails to trace the dynamically-loaded next-server runtime files
 * (e.g. app-route-turbo.runtime.prod.js), so API route handlers throw
 * "Cannot find module …app-route-turbo.runtime.prod.js" at runtime. Copy the
 * whole compiled/next-server dir over to be safe.
 */
import { cpSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

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

// Backfill the next-server runtime files that file-tracing misses.
function nextServerDir(nmRoot) {
  const pnpm = join(nmRoot, ".pnpm");
  if (!existsSync(pnpm)) return null;
  const pkg = readdirSync(pnpm).find((d) => d.startsWith("next@"));
  if (!pkg) return null;
  const dir = join(pnpm, pkg, "node_modules", "next", "dist", "compiled", "next-server");
  return existsSync(dir) ? dir : null;
}
const src = nextServerDir(join(root, "node_modules"));
const dst = nextServerDir(join(sa, "node_modules"));
if (src && dst) {
  cpSync(src, dst, { recursive: true });
  console.log("staged: .next/static + public + next-server runtime into .next/standalone");
} else {
  console.log("staged: .next/static + public (could not locate next-server dir to backfill runtime)");
}
