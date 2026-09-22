import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, require } from "./local-runtime.mjs";

process.chdir(ROOT);
if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));
let failed = false;
const report = (name, ok, detail, optional = false) => {
  console.log(`${ok ? "OK" : optional ? "OPTIONAL" : "MISSING"} ${name}: ${detail}`);
  if (!ok && !optional) failed = true;
};
const check = (name, command, args, optional = false) => {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout: 20000 });
  report(name, result.status === 0, result.status === 0 ? (result.stdout || result.stderr).split(/\r?\n/)[0] : `install/configure ${command}`, optional);
};
report("Node", Number(process.versions.node.split(".")[0]) >= 22 && Number(process.versions.node.split(".")[0]) < 26, process.version);
for (const name of ["next", "tsx", "@prisma/client"]) {
  try { report(name, true, require(`${name}/package.json`).version); }
  catch { report(name, false, "run corepack pnpm install --frozen-lockfile"); }
}
{
  // @prisma/client resolving is not enough: it requires a generated .prisma/client
  // underneath, which only exists after a prisma generate. Probe it the way the app does.
  const generated = spawnSync(process.execPath, ["-e", "require('@prisma/client')"], { encoding: "utf8", windowsHide: true, timeout: 20000, cwd: ROOT });
  report("Prisma client (generated)", generated.status === 0, generated.status === 0 ? "generated" : "run corepack pnpm db:sqlite:generate");
}
try {
  const dir = dirname(require.resolve("electron/package.json"));
  const installed = existsSync(join(dir, "dist", readFileSync(join(dir, "path.txt"), "utf8").trim()));
  report("Electron", installed, installed ? "desktop runtime" : "run node node_modules/electron/install.js");
} catch { report("Electron", false, "run node node_modules/electron/install.js"); }
// Same order as src/lib/ffmpeg/binary.ts: explicit path, SLOPSTUDIO_FFMPEG_DIR, the
// vendor/ffmpeg the fetch scripts fill, then PATH.
const exe = process.platform === "win32" ? ".exe" : "";
const vendor = join(ROOT, "vendor", "ffmpeg");
const vendored = ["ffmpeg", "ffprobe"].every((n) => existsSync(join(vendor, n + exe)));
const binary = (name) => process.env[`SLOPSTUDIO_${name.toUpperCase()}_PATH`] || (process.env.SLOPSTUDIO_FFMPEG_DIR ? join(process.env.SLOPSTUDIO_FFMPEG_DIR, name + exe) : vendored ? join(vendor, name + exe) : name);
check("FFmpeg", binary("ffmpeg"), ["-version"]);
check("FFprobe", binary("ffprobe"), ["-version"]);
{
  // Titles and captions need drawtext (libfreetype) and ass (libass). Homebrew's ffmpeg
  // ships without either; the static build from scripts/fetch-ffmpeg.sh has both.
  const filters = spawnSync(binary("ffmpeg"), ["-hide_banner", "-filters"], { encoding: "utf8", windowsHide: true, timeout: 20000 });
  // `ffmpeg -filters` lines look like " T.C drawtext          V->V  Draw text ...": flags, name.
  const has = (f) => filters.status === 0 && new RegExp("^[ ]*[^ ]+[ ]+" + f + "[ ]", "m").test(filters.stdout);
  const missing = ["drawtext", "ass"].filter((f) => !has(f));
  const hint = process.platform === "darwin" ? "run bash scripts/fetch-ffmpeg.sh (Homebrew's ffmpeg lacks libfreetype/libass)" : process.platform === "win32" ? "run scripts/fetch-ffmpeg.ps1 or install a full ffmpeg build" : "install an ffmpeg built with libfreetype and libass, or run bash scripts/fetch-ffmpeg.sh";
  report("FFmpeg filters", missing.length === 0, missing.length ? `missing ${missing.join(", ")}: ${hint}` : `drawtext + ass (${binary("ffmpeg")})`);
}
check("YouTube import", process.env.YTDLP_BIN || "yt-dlp", ["--version"], true);
check("YouTube JS runtime", "deno", ["--version"], true);
const venv = join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.SLOPSTUDIO_PYTHON || (existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3");
check("Beat detection", python, ["-c", "import librosa; print('librosa available')"], true);
check("Transcription", python, ["-c", "import whisper; print('Whisper available')"], true);
check("Stem separation", python, ["-c", "import demucs, torch, torchaudio, torchcodec; print('Demucs / torch / torchcodec available')"], true);
report("Codex configuration", existsSync(join(ROOT, ".codex", "config.toml")), "run corepack pnpm codex:setup", true);
process.exitCode = failed ? 1 : 0;
