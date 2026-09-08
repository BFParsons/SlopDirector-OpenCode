import { expect, test } from "@playwright/test";
import { addStillSegment, createProject, deleteProject, openEditor, openPanel, snapshot } from "./helpers";

test.describe("Effect stack: ffmpeg 9 export-only effects", () => {
  let id: string;
  test.beforeAll(async ({ request }) => {
    id = await createProject(request, { title: "effects (pw)" });
    await addStillSegment(request, id);
  });
  test.afterAll(async ({ request }) => deleteProject(request, id));

  test("the new effects are offered, add Stabilize, save → persisted", async ({ page, request }) => {
    await openEditor(page, id);
    await openPanel(page, "Effects");
    // Select the clip on the timeline (its tooltip starts with the clip number).
    await page.locator('div[title^="1. "]').first().click();
    await page.getByRole("button", { name: /^\+ Add$/ }).click();
    for (const label of ["Denoise", "Detail (CAS)", "Deinterlace", "Deshake", "Stabilize", "Smooth Slow Motion", "HDR → SDR"]) {
      await expect(page.getByRole("button", { name: new RegExp(label.replace(/[()]/g, "\\$&")) })).toBeVisible();
    }
    await page.getByRole("button", { name: /Stabilize/ }).click();
    await expect(page.getByText("on export").first()).toBeVisible();
    await expect(page.getByText(/Shakiness/)).toBeVisible();
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect.poll(async () => {
      const s = await snapshot(request, id);
      return (s.segments[0].effects ?? []).map((e: { kind: string; enabled: boolean }) => `${e.kind}:${e.enabled}`);
    }).toEqual(["stabilize:true"]);
  });
});
