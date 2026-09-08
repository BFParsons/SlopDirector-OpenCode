import { expect, test } from "@playwright/test";
import {
  addMusicBed,
  addStillSegment,
  createProject,
  deleteProject,
  finalRenderPath,
  identityCubePath,
  openEditor,
  probe,
  snapshot,
  waitForRender,
} from "./helpers";
import { readFileSync } from "node:fs";

test.describe("Export formats", () => {
  const created: string[] = [];
  test.afterAll(async ({ request }) => {
    for (const id of created) await deleteProject(request, id);
  });

  test("Export dialog: format picker → HEVC render → .mp4 tagged hvc1", async ({ page, request }) => {
    test.setTimeout(180_000);
    const id = await createProject(request, { title: "export ui (pw)" });
    created.push(id);
    await addStillSegment(request, id);
    await openEditor(page, id);

    await page.getByRole("button", { name: /^Export/ }).click();
    await expect(page.getByText("Export settings")).toBeVisible();
    await expect(page.getByText("640 × 360 · 16:9 · SD")).toBeVisible();
    const radios = page.locator("input[name=export-format]");
    await expect(radios).toHaveCount(5);
    await expect(radios.nth(0)).toBeChecked(); // h264 default
    const hevc = page.locator("input[name=export-format][value=hevc]");
    await expect(hevc).toBeEnabled();
    await hevc.check();
    await page.getByRole("button", { name: /^Export \.mp4/ }).click();

    await expect(page.getByText("Your export is ready")).toBeVisible({ timeout: 120_000 });
    const link = page.getByRole("link", { name: /Save to your computer/ });
    await expect(link).toHaveAttribute("href", /\/api\/assets\//);
    await expect(link).toHaveAttribute("download", /\.mp4$/);

    const snap = await snapshot(request, id);
    expect(snap.exportCodec).toBe("hevc");
    expect(snap.finalRender?.status).toBe("READY");
    const v = probe(finalRenderPath(id)).video;
    expect(v[0]).toBe("hevc");
    expect(v[1]).toBe("hvc1");
  });

  for (const [codec, expectVideo, expectAudio, ext] of [
    ["av1", ["av1", "av01", "yuv420p"], "aac", "mp4"],
    ["vp9", ["vp9"], "opus", "webm"],
    ["prores", ["prores", "apch", "yuv422p10le"], "pcm_s16le", "mov"],
  ] as const) {
    test(`API render: ${codec} with LUT + libass captions + effects`, async ({ request }) => {
      test.setTimeout(180_000);
      const id = await createProject(request, { title: `export ${codec} (pw)` });
      created.push(id);
      const seg = await addStillSegment(request, id);
      await addMusicBed(request, id); // so the container's audio codec is exercised too
      const patch = await request.patch(`/api/projects/${id}`, {
        data: {
          exportCodec: codec,
          captionsEnabled: true,
          captionStyle: "POP",
          captionPosition: "BOTTOM_CENTER",
          voScript: `Hello there. Styled libass captions on a ${codec} export.`,
          colorLook: "WARM",
          segments: [
            {
              id: seg,
              effects: [
                { id: "fx1", kind: "denoise", enabled: true, params: { strength: 3, method: "fast" } },
                { id: "fx2", kind: "detail", enabled: true, params: { strength: 0.5 } },
                { id: "fx3", kind: "deshake", enabled: true, params: { range: 16 } },
              ],
            },
          ],
        },
      });
      expect(patch.ok(), await patch.text()).toBeTruthy();
      const lut = await request.post(`/api/projects/${id}/lut`, {
        multipart: { file: { name: "identity.cube", mimeType: "application/octet-stream", buffer: readFileSync(identityCubePath()) } },
      });
      expect(lut.ok(), await lut.text()).toBeTruthy();
      expect((await lut.json()).data.lutAssetId).toBeTruthy();

      const start = await request.post(`/api/projects/${id}/render`, { data: {} });
      expect(start.ok(), await start.text()).toBeTruthy();
      const done = await waitForRender(request, id);
      expect(done.finalRender.status).toBe("READY");
      const file = finalRenderPath(id);
      expect(file.endsWith(`.${ext}`)).toBeTruthy();
      const p = probe(file);
      for (let i = 0; i < expectVideo.length; i++) expect(p.video[i]).toBe(expectVideo[i]);
      expect(p.audio[0]).toBe(expectAudio);
    });
  }

  test("render API reports per-host format availability", async ({ request }) => {
    const id = await createProject(request, { title: "formats (pw)" });
    created.push(id);
    const res = await request.get(`/api/projects/${id}/render`);
    expect(res.ok()).toBeTruthy();
    const { data } = await res.json();
    expect(data.formats.map((f: { codec: string }) => f.codec)).toEqual(["h264", "hevc", "av1", "vp9", "prores"]);
    for (const f of data.formats) expect(f.available).toBeTruthy(); // this ffmpeg build has every CPU encoder
    expect(data.formats.find((f: { codec: string }) => f.codec === "vp9").hardware).toBeNull(); // CPU-only by design
  });
});
