// electron-builder invokes `pnpm list` itself. Corepack users may have no global
// pnpm shim; give this build a local shim pointing to the pnpm that launched it.
import { chmodSync, cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join } from "node:path";
import { ROOT, require, run } from "./local-runtime.mjs";

try {
  const env = { ...process.env };
  if (process.platform === "win32") {
    const pnpmEntry = env.npm_execpath || join(dirname(process.execPath), "node_modules", "corepack", "dist", "pnpm.js");
    if (!pnpmEntry || !existsSync(pnpmEntry)) throw new Error("Run packaging through corepack pnpm desktop:build:win.");
    const bin = join(ROOT, ".data", "package-bin");
    mkdirSync(bin, { recursive: true });
    const quote = (value) => `"${value.replaceAll("%", "%%")}"`;
    writeFileSync(join(bin, "pnpm.cmd"), `@echo off\r\n${quote(process.execPath)} ${quote(pnpmEntry)} %*\r\n`);
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
    env[pathKey] = bin + delimiter + (env[pathKey] || "");

    // NSIS expands Windows junctions. A traced pnpm package then loses access
    // to dependencies in its former .pnpm parent. Build a locked, hoisted
    // production tree for distribution so every installed path is a real dir.
    const runtime = join(ROOT, ".data", "windows-runtime");
    mkdirSync(runtime, { recursive: true });
    // The workspace file keeps pnpm inside this staging directory and preserves
    // the dependency overrides that produced the lockfile.
    for (const file of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]) cpSync(join(ROOT, file), join(runtime, file));
    await run(pnpmEntry, ["--dir", runtime, "install", "--prod", "--ignore-scripts", "--frozen-lockfile", "--prefer-offline", "--config.node-linker=hoisted"], env);
    // @prisma/client's generated SQLite engine is deliberately not regenerated
    // by install scripts; use exactly the client used for the standalone build.
    const prismaRequire = createRequire(require.resolve("@prisma/client"));
    const client = dirname(prismaRequire.resolve(".prisma/client/package.json"));
    cpSync(client, join(runtime, "node_modules", ".prisma", "client"), { recursive: true });
  } else {
    // macOS / Linux: same idea, a POSIX shim. Without it `corepack pnpm desktop:build:mac`
    // fails inside electron-builder on a machine that never ran `corepack enable`.
    const pnpmEntry = env.npm_execpath;
    if (pnpmEntry && existsSync(pnpmEntry)) {
      const bin = join(ROOT, ".data", "package-bin");
      mkdirSync(bin, { recursive: true });
      const shim = join(bin, "pnpm");
      writeFileSync(shim, `#!/bin/sh
exec "${process.execPath}" "${pnpmEntry}" "$@"
`);
      chmodSync(shim, 0o755);
      env.PATH = bin + delimiter + (env.PATH || "");
    }
  }
  await run(require.resolve("electron-builder/cli.js"), process.argv.slice(2), env);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
