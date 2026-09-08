import { expect, test } from "@playwright/test";
import { createProject, deleteProject, snapshot } from "./helpers";

test.describe("Start screen + Assembly dialog", () => {
  const created: string[] = [];
  test.afterAll(async ({ request }) => {
    for (const id of created) await deleteProject(request, id);
  });

  test("two mode cards, no Storyboard", async ({ page }) => {
    await page.goto("/start");
    await expect(page.locator(".squish-title")).toHaveText(["Assembly", "Audio Studio"]);
    await expect(page.getByText(/storyboard/i)).toHaveCount(0);
  });

  test("frame presets, custom size rounding, create → editor at that frame", async ({ page, request }) => {
    await page.goto("/start");
    await page.getByRole("button", { name: /^Assembly$/ }).click();
    await expect(page.getByRole("tab", { name: "New project" })).toHaveAttribute("aria-selected", "true");

    const preset = page.locator("#frame-preset");
    const w = page.getByLabel("Width (px)");
    const h = page.getByLabel("Height (px)");
    await expect(preset).toHaveValue("fhd-1080");
    await expect(w).toHaveValue("1920");
    await expect(h).toHaveValue("1080");

    // Presets exist for every medium, up to 4K.
    const groups = await preset.locator("optgroup").evaluateAll((els) => els.map((e) => (e as HTMLOptGroupElement).label));
    expect(groups.join(" | ")).toMatch(/YouTube.*Cinema.*Vertical.*Square.*Portrait.*Ultrawide.*Classic.*Custom/);
    await preset.selectOption("uhd-4k");
    await expect(w).toHaveValue("3840");
    await expect(h).toHaveValue("2160");
    await expect(page.getByTestId("frame-summary")).toHaveText("16:9 · 4K");

    // Typing switches to Custom; odd sizes round to even on blur.
    await w.fill("1000");
    await h.fill("1001");
    await h.blur();
    await expect(preset).toHaveValue("custom");
    await expect(h).toHaveValue("1002");
    await expect(page.getByRole("button", { name: /Create 1000 × 1002/ })).toBeVisible();

    await page.getByRole("button", { name: /Create 1000 × 1002/ }).click();
    await page.waitForURL(/\/projects\/[a-z0-9]+$/);
    const id = page.url().split("/").pop()!;
    created.push(id);

    const snap = await snapshot(request, id);
    expect(snap.frameWidth).toBe(1000);
    expect(snap.frameHeight).toBe(1002);
    expect(snap.aspectRatio).toBe("R1_1"); // closest provider-facing preset

    // The live preview keeps the custom aspect (capped to the 854 px preview width).
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const [cw, ch] = await canvas.evaluate((c) => [Number(c.getAttribute("width")), Number(c.getAttribute("height"))]);
    expect(cw).toBe(854);
    expect(Math.abs(ch - Math.round((854 * 1002) / 1000))).toBeLessThanOrEqual(1);
  });

  test("Open project tab lists projects and opens one", async ({ page, request }) => {
    const id = await createProject(request, { title: "open-me (pw)", frameWidth: 1280, frameHeight: 720 });
    created.push(id);
    await page.goto("/start");
    await page.getByRole("button", { name: /^Assembly$/ }).click();
    await page.getByRole("tab", { name: "Open project" }).click();
    const row = page.getByTestId("project-list").getByRole("button", { name: /open-me \(pw\)/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("1280 × 720");
    await page.getByLabel("Search projects").fill("open-me");
    await expect(page.getByTestId("project-list").getByRole("button")).toHaveCount(1);
    await row.click();
    await page.waitForURL(new RegExp(`/projects/${id}$`));
  });
});
