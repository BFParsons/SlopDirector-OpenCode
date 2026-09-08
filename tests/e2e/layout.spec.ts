import { expect, test } from "@playwright/test";
import { createProject, deleteProject, expectPanelsInside, openEditor } from "./helpers";

test.describe("Workspace fits the laptop viewport", () => {
  let id: string;
  test.beforeAll(async ({ request }) => {
    id = await createProject(request, { title: "layout (pw)" });
  });
  test.afterAll(async ({ request }) => deleteProject(request, id));

  test("default Assembly workspace: 3 panels inside a single-row toolbar layout", async ({ page }) => {
    await openEditor(page, id);
    const boxes = await expectPanelsInside(page);
    expect(boxes.panels).toHaveLength(3);
    expect(boxes.c.t).toBeLessThanOrEqual(48); // toolbar is one row (was 79 px)
    // Monitor top-left, timeline below it, media bucket as the right column.
    const [monitor, timeline, bucket] = boxes.panels;
    expect(monitor.t).toBeLessThan(timeline.t);
    expect(bucket.l).toBeGreaterThan(monitor.r - 1);
    expect(bucket.b - bucket.t).toBeGreaterThan(monitor.b - monitor.t);
  });

  test("+ Panel menu lists every panel and fits the window", async ({ page }) => {
    await openEditor(page, id);
    await page.getByRole("button", { name: /^\+ ?Panel$/ }).click();
    const menu = page.locator("div.absolute.z-\\[10000\\]").first();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button")).toHaveCount(18);
    const box = (await menu.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(490);
    expect(await menu.evaluate((m) => m.scrollHeight <= m.clientHeight + 1)).toBeTruthy();
  });

  test("narrow tile: toolbar collapses to icons and never overflows", async ({ page }) => {
    await page.setViewportSize({ width: 461, height: 490 });
    await openEditor(page, id);
    const bar = page.locator(".react-draggable").first().locator("xpath=../preceding-sibling::div[1]");
    expect(await bar.evaluate((b) => b.scrollWidth <= b.clientWidth)).toBeTruthy();
    // Labels are hidden below `md`; the icon buttons remain.
    await expect(page.getByRole("button", { name: /^\+$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^▦$/ })).toBeVisible();
  });

  test("resize round-trip restores the layout exactly", async ({ page }) => {
    await openEditor(page, id);
    const before = (await expectPanelsInside(page)).panels;
    await page.setViewportSize({ width: 461, height: 490 });
    await page.waitForTimeout(400);
    await page.setViewportSize({ width: 936, height: 490 });
    await page.waitForTimeout(400);
    const after = (await expectPanelsInside(page)).panels;
    for (let i = 0; i < before.length; i++) {
      for (const k of ["l", "t", "r", "b"] as const) expect(Math.abs(after[i][k] - before[i][k])).toBeLessThanOrEqual(2);
    }
  });

  test("Audio Studio default: all 7 panels on screen", async ({ page }) => {
    await openEditor(page, id, "?ws=audio-studio");
    const boxes = await expectPanelsInside(page);
    expect(boxes.panels).toHaveLength(7);
  });
});
