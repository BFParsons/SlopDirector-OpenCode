import { lstatSync, existsSync, rmSync, realpathSync } from "node:fs";
import { dirname, join, relative, isAbsolute } from "node:path";
import { ROOT, localEnvironment, require, run } from "./local-runtime.mjs";

try {
  // During prerendering auth must stay dynamic; there is no user database yet.
  const env = { ...localEnvironment(), NODE_ENV: "production", SLOPSTUDIO_DESKTOP: "0", WORKER_ENABLED: "false" };
  const standalone = join(ROOT, ".next", "standalone");
  // Only remove this build output, never dist/releases or a link outside the repo.
  if (existsSync(standalone)) {
    const rel = relative(realpathSync(ROOT), realpathSync(standalone));
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || lstatSync(standalone).isSymbolicLink()) {
      throw new Error("Refusing to clean a standalone output outside this repository.");
    }
    rmSync(standalone, { recursive: true, force: true });
  }
  await run(join(dirname(require.resolve("prisma/package.json")), "build", "index.js"), ["generate", "--schema", "prisma/schema.sqlite.prisma"], env);
  await run(require.resolve("next/dist/bin/next"), ["build"], env);
  await run(join(ROOT, "scripts", "postbuild-standalone.mjs"), [], env);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
