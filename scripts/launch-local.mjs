import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { ROOT, SERVER, localEnvironment, require, launch, completed, run, ensureBuild, requireFreePort } from "./local-runtime.mjs";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("node scripts/launch-local.mjs [--headless] [--dev|--prod]\nDefaults: production, localhost:38473. Override with SLOPSTUDIO_PORT (or PORT).");
  process.exit(0);
}
const unknown = args.filter((a) => !["--headless", "--dev", "--prod"].includes(a));
if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(" ")}`);
const headless = args.includes("--headless");
const dev = args.includes("--dev");
const children = new Set();
const track = (child) => { children.add(child); child.once("exit", () => children.delete(child)); return child; };
const stop = () => { for (const child of children) child.kill(); };
process.once("SIGINT", () => { stop(); process.exit(130); });
process.once("SIGTERM", () => { stop(); process.exit(143); });
process.once("exit", stop);

try {
  const env = localEnvironment();
  const port = Number(env.SLOPSTUDIO_PORT || env.PORT || 38473);
  await requireFreePort(port);
  Object.assign(env, { PORT: String(port), SLOPSTUDIO_PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: dev ? "development" : "production" });
  if (dev) {
    await run(join(dirname(require.resolve("prisma/package.json")), "build", "index.js"), ["generate", "--schema", "prisma/schema.sqlite.prisma"], env);
  } else {
    await ensureBuild(env);
  }
  console.log(`SlopStudio ${headless ? "headless" : "desktop"} (${dev ? "dev" : "production"}) at http://127.0.0.1:${port}`);
  if (headless) {
    const child = dev
      ? launch(require.resolve("next/dist/bin/next"), ["dev", "-H", "127.0.0.1", "-p", String(port)], env)
      : launch(SERVER, [], env, dirname(SERVER));
    await completed(track(child));
  } else {
    let devServer;
    if (dev) {
      devServer = track(launch(require.resolve("next/dist/bin/next"), ["dev", "-H", "127.0.0.1", "-p", String(port)], env));
      env.ELECTRON_DEV = "1";
      env.SLOPSTUDIO_DEV_URL = `http://127.0.0.1:${port}`;
    } else {
      delete env.ELECTRON_DEV;
    }
    delete env.ELECTRON_RUN_AS_NODE;
    const electron = track(spawn(require("electron"), [join(ROOT, "electron", "main.js")], { cwd: ROOT, env, stdio: "inherit", windowsHide: true }));
    if (devServer) devServer.once("exit", () => electron.kill());
    await completed(electron);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stop();
}
