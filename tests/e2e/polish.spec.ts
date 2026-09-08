import { expect, test } from "@playwright/test";
import { addStillSegment, createProject, deleteProject, identityCubePath, openEditor, openPanel, snapshot } from "./helpers";

test.describe("Polish: custom LUT + libass captions", () => {
  let id: string;
  test.beforeAll(async ({ request }) => {
    id = await createProject(request, { title: "polish (pw)" });
    await addStillSegment(request, id);
  });
  test.afterAll(async ({ request }) => deleteProject(request, id));

  test("upload a .cube LUT, see it loaded, remove it", async ({ page, request }) => {
    await openEditor(page, id);
    await openPanel(page, "Polish");
    const upload = page.getByRole("button", { name: /Upload \.cube LUT/ });
    await expect(upload).toBeVisible();
    await page.locator('input[type=file][accept=".cube"]').setInputFiles(identityCubePath());
    await expect(page.getByText("LUT loaded")).toBeVisible();
    await expect(page.getByText("on export", { exact: true })).toBeVisible();
    expect((await snapshot(request, id)).lutAssetId).toBeTruthy();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(upload).toBeVisible();
    expect((await snapshot(request, id)).lutAssetId).toBeNull();
  });

  test("captions: enable, pick Box style, save → persisted", async ({ page, request }) => {
    await openEditor(page, id);
    await openPanel(page, "Polish");
    const toggle = page.getByLabel(/Burn in captions/);
    await toggle.check();
    const style = page.locator("select").filter({ has: page.locator('option[value="BOX"]') }).first();
    await expect(style).toBeVisible();
    await style.selectOption("BOX");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect.poll(async () => (await snapshot(request, id)).captionsEnabled).toBe(true);
    const snap = await snapshot(request, id);
    expect(snap.captionStyle).toBe("BOX");
  });
});
