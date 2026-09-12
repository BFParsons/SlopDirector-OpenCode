// Shared native Node launch/build helpers. No shell or global pnpm shim needed.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import net from "node:net";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const require = createRequire(join(ROOT, "package.json"));
export const SERVER = join(ROOT, ".next", "standalone", "server.js");

export function localEnvironment() {
  process.chdir(ROOT);
  if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));
  const data = join(ROOT, ".data");
  mkdirSync(data, { recursive: true });
  const secret = join(data, "auth-secret");
  if (!process.env.AUTH_SECRET && !existsSync(secret)) {
    writeFileSync(secret, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  }
  const env = {
    ...process.env,
    SLOPSTUDIO_DB: process.env.SLOPSTUDIO_DB ?? "sqlite",
    SLOPSTUDIO_DESKTOP: process.env.SLOPSTUDIO_DESKTOP ?? "1",
    DATABASE_URL: process.env.DATABASE_URL ?? `file:${join(data, "slopstudio.db").replaceAll("\\", "/")}`,
    ASSET_ROOT: resolve(process.env.ASSET_ROOT || join(data, "assets")),
    AUTH_SECRET: process.env.AUTH_SECRET || readFileSync(secret, "utf8").trim(),
    SLOPSTUDIO_SCHEMA_SQL: join(ROOT, "prisma", "desktop-schema.sql"),
    WORKER_ENABLED: "true",
  };
  const venvPython = join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!env.SLOPSTUDIO_PYTHON && existsSync(venvPython)) env.SLOPSTUDIO_PYTHON = venvPython;
  if (env.SLOPSTUDIO_DB !== "sqlite" || !env.DATABASE_URL.startsWith("file:")) {
    throw new Error("Local desktop launch requires SQLite. Use pnpm dev for PostgreSQL, or update the desktop settings in .env.");
  }
  mkdirSync(env.ASSET_ROOT, { recursive: true });
  return env;
}

export function launch(entry, args = [], env = process.env, cwd = ROOT) {
  return spawn(process.execPath, [entry, ...args], { cwd, env, stdio: "inherit", windowsHide: true });
}
export function completed(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Process failed (${signal || code})`)));
  });
}
export async function run(entry, args = [], env = process.env) {
  await completed(launch(entry, args, env));
}
export async function requireFreePort(port, host = "127.0.0.1") {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Port must be between 1 and 65535.");
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`Port ${port} is in use. Close the existing app or select another SLOPSTUDIO_PORT; no processes were stopped.`)));
    probe.listen(port, host, () => probe.close(resolve));
  });
}
export function buildIsStale() {
  if (!existsSync(SERVER)) return true;
  const built = statSync(SERVER).mtimeMs;
  const newer = (file) => {
    if (!existsSync(file)) return false;
    const info = statSync(file);
    return info.mtimeMs > built || (info.isDirectory() && readdirSync(file).some((name) => newer(join(file, name))));
  };
  return ["src", "prisma", "public", "scripts", "next.config.ts", "package.json", "pnpm-lock.yaml", ".env"].some((p) => newer(join(ROOT, p)));
}
export async function ensureBuild(env) {
  if (buildIsStale()) {
    console.log("Building the production bundle (first run / sources changed)…");
    await run(join(ROOT, "scripts", "build-desktop.mjs"), [], env);
  }
}
