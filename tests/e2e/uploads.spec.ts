import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createProject, deleteProject } from "./helpers";

test("MKV upload without a MIME type is accepted as video", async ({ request }) => {
  const id = await createProject(request, { title: "mkv (pw)" });
  try {
    const dir = mkdtempSync(path.join(tmpdir(), "slop-mkv-"));
    const mkv = path.join(dir, "clip.mkv");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", mkv]);
    const up = await request.post("/api/uploads", {
      multipart: { projectId: id, file: { name: "clip.mkv", mimeType: "application/octet-stream", buffer: readFileSync(mkv) } },
    });
    expect(up.ok(), await up.text()).toBeTruthy();
    const j = (await up.json()).data;
    expect(j.mime).toBe("video/x-matroska");
    expect(j.durationS).toBeGreaterThan(0.5);
  } finally {
    await deleteProject(request, id);
  }
});
