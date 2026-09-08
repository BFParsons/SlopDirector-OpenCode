import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createProject, openEditor } from "./helpers";

const H = { "X-Requested-With": "spotforge", "X-Slop-Client": "pw-agent" };
const TMP = path.resolve("test-results/agent-api");

function genClip(file: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-t", "3", "-i", "testsrc2=size=640x360:rate=30",
    "-f", "lavfi", "-t", "3", "-i", "smptebars=size=640x360:rate=30",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-map", "2:a", "-t", "6",
    "-af", "volume='if(lt(t,4),1,0)':eval=frame",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file,
  ]);
  return file;
}

test.describe("Agent API: perception, drafts, checkpoints, live refresh", () => {
  test("inspect endpoints see cuts, silences, frames; draft renders; checkpoints restore; editor refreshes", async ({ page, request }) => {
    test.setTimeout(180_000);
    const clip = genClip(path.join(TMP, "clip.mp4"));
    const pid = await createProject(request, { title: "agent api (pw)" });
    const up = await request.post("/api/uploads", {
      headers: H,
      multipart: { projectId: pid, file: { name: "clip.mp4", mimeType: "video/mp4", buffer: readFileSync(clip) } },
    });
    const assetId = ((await up.json()) as { data: { id: string } }).data.id;

    // --- perception
    const scenes = (await (await request.get(`/api/assets/${assetId}/scenes?threshold=0.3`)).json()).data as { cuts: number[]; shots: unknown[] };
    expect(scenes.cuts.length).toBe(1);
    expect(scenes.cuts[0]).toBeGreaterThan(2.8);
    expect(scenes.cuts[0]).toBeLessThan(3.2);
    const sil = (await (await request.get(`/api/assets/${assetId}/silences?noise=-40&min=0.5`)).json()).data as { silences: { startS: number }[]; speech: { startS: number; endS: number }[] };
    expect(sil.silences.length).toBe(1);
    expect(sil.silences[0].startS).toBeGreaterThan(3.8);
    expect(sil.speech.length).toBe(1);
    const frame = await request.get(`/api/assets/${assetId}/frame?t=1&w=320`);
    expect(frame.headers()["content-type"]).toBe("image/jpeg");
    expect((await frame.body()).length).toBeGreaterThan(1000);
    const sheet = await request.get(`/api/assets/${assetId}/contact-sheet?cols=3&rows=2&w=600`);
    expect(sheet.headers()["content-type"]).toBe("image/jpeg");
    expect(JSON.parse(sheet.headers()["x-frame-times"]).length).toBe(6);
    const sheetJson = (await (await request.get(`/api/assets/${assetId}/contact-sheet?cols=3&rows=2&w=600&format=json`)).json()).data as { times: number[] };
    expect(sheetJson.times.length).toBe(6);

    // --- timeline + checkpoint
    await request.post(`/api/projects/${pid}/segments`, { headers: H, data: { source: "UPLOAD_VIDEO", sourceAssetId: assetId } });
    const cp = (await (await request.post(`/api/projects/${pid}/checkpoints`, { headers: H, data: { label: "one segment" } })).json()).data as { id: string; segments: number };
    expect(cp.segments).toBe(1);

    // --- the open editor sees an external edit without reload
    await openEditor(page, pid);
    const title = page.getByRole("textbox", { name: "Project title" });
    await expect(title).toHaveValue("agent api (pw)");
    const patched = await request.patch(`/api/projects/${pid}`, { headers: H, data: { title: "renamed by an agent" } });
    expect(patched.ok()).toBeTruthy();
    await expect(title).toHaveValue("renamed by an agent", { timeout: 10_000 });

    // --- draft render
    const r = await request.post(`/api/projects/${pid}/render`, { headers: H, data: { draft: true } });
    expect(r.ok()).toBeTruthy();
    let draftAssetId: string | null = null;
    for (let i = 0; i < 150 && !draftAssetId; i++) {
      await new Promise((res) => setTimeout(res, 400));
      const snap = (await (await request.get(`/api/projects/${pid}`)).json()).data as { status: string; finalRender: { draftAssetId: string | null; assetId: string | null } | null };
      if (snap.status !== "RENDERING" && snap.finalRender?.draftAssetId) draftAssetId = snap.finalRender.draftAssetId;
      expect(snap.finalRender?.assetId ?? null).toBeNull(); // a draft never becomes "the final"
    }
    expect(draftAssetId).toBeTruthy();
    const draft = await request.get(`/api/projects/${pid}/draft`);
    expect(draft.ok()).toBeTruthy();
    expect(Number(draft.headers()["content-length"] ?? (await draft.body()).length)).toBeGreaterThan(10_000);
    const draftFrame = await request.get(`/api/assets/${draftAssetId}/frame?t=0.5&w=200`);
    expect(draftFrame.ok()).toBeTruthy();

    // --- restore the checkpoint after a destructive edit
    const snap = (await (await request.get(`/api/projects/${pid}`)).json()).data as { segments: { id: string }[] };
    await request.delete(`/api/projects/${pid}/segments/${snap.segments[0].id}`, { headers: H });
    const restored = (await (await request.post(`/api/projects/${pid}/checkpoints/${cp.id}/restore`, { headers: H })).json()).data as { title: string; segments: { id: string }[] };
    expect(restored.segments.length).toBe(1);
    expect(restored.segments[0].id).toBe(snap.segments[0].id);
    expect(restored.title).toBe("agent api (pw)");
    await expect(title).toHaveValue("agent api (pw)", { timeout: 10_000 });

    await request.delete(`/api/projects/${pid}`, { headers: H });
  });
});
