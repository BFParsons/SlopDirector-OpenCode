/**
 * Seed an N-clip project to benchmark "clips before lag".
 *
 *   pnpm tsx --env-file=.env scripts/seed-perf-project.ts [N]   # default 120
 *
 * Builds ONE cheap local test clip (ffmpeg testsrc — no API spend) then copies
 * it into N distinct assets. The copies matter: MediaCache dedups decoders by
 * URL, so N segments sharing one asset would create only ONE decoder. N distinct
 * asset URLs reproduce the real decoder/`preload="auto"` pressure.
 *
 * Open the printed URL with `?perf=1` to read the HUD. Delete the project from
 * the dashboard when done (it's a normal DRAFT project).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { ASSET_ROOT } from "@/lib/assets/storage";

const N = Math.max(1, Math.min(500, Number(process.argv[2] ?? 120)));
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No user found — run `pnpm create-admin` first.");

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      title: `PERF ${N} clips`,
      status: "DRAFT",
      // required model fields — never used (we don't generate/render here)
      llmModel: "perf/none",
      videoModel: "perf/none",
      ttsModel: "perf/none",
      targetLengthS: N * 4,
    },
  });

  const dir = path.join(ASSET_ROOT, project.id);
  mkdirSync(dir, { recursive: true });

  // One source clip: 6s, 1280x720, 30fps, h264 — ultrafast, tiny, no API.
  const master = path.join(dir, "perf-master.mp4");
  const ff = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f", "lavfi",
      "-i", "testsrc=size=1280x720:rate=30:duration=6",
      "-pix_fmt", "yuv420p",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      master,
    ],
    { stdio: "inherit" },
  );
  if (ff.status !== 0) throw new Error("ffmpeg testsrc generation failed");

  process.stdout.write(`Creating ${N} clips`);
  for (let i = 0; i < N; i++) {
    const rel = path.join(project.id, `perf-${i}.mp4`);
    const abs = path.join(ASSET_ROOT, rel);
    copyFileSync(master, abs);
    const asset = await prisma.asset.create({
      data: {
        projectId: project.id,
        kind: "UPLOAD_VIDEO",
        path: rel,
        mime: "video/mp4",
        sizeBytes: statSync(abs).size,
      },
    });
    await prisma.segment.create({
      data: {
        projectId: project.id,
        index: i,
        source: "UPLOAD_VIDEO",
        sourceAssetId: asset.id,
        durationS: 4,
        sourceDurationS: 6,
        trimStartS: 0,
        track: 0,
        muted: true, // stress video decoders, not the audio pool
        status: "READY",
      },
    });
    if (i % 20 === 19) process.stdout.write(".");
  }
  process.stdout.write("\n");

  console.log(`\nSeeded project ${project.id} — ${N} clips.`);
  console.log(`Open:  /projects/${project.id}?perf=1`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
