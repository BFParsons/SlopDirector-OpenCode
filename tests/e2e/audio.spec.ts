import { expect, test } from "@playwright/test";
import { createProject, deleteProject, openEditor, testWavPath } from "./helpers";

test.describe("Audio Studio: RNN denoise, leveler, stretch, audiogram, mixdown formats", () => {
  let id: string;
  test.beforeAll(async ({ request }) => {
    id = await createProject(request, { title: "audio (pw)" });
  });
  test.afterAll(async ({ request }) => deleteProject(request, id));

  test("import → process (RNN + leveler) → stretch → audiogram → FLAC mixdown", async ({ page }) => {
    test.setTimeout(240_000);
    await openEditor(page, id, "?ws=audio-studio");

    // Import a track via the Audio Importer's file input.
    await page.locator('input[type=file][accept^="audio/*"]').setInputFiles(testWavPath());
    await expect(page.getByText("voice", { exact: false }).first()).toBeVisible({ timeout: 30_000 });

    // Processing Rack: the two new modules exist; apply them → a "· processed" track.
    const rnn = page.getByLabel("Noise suppression (RNN)");
    const lev = page.getByLabel("Speech leveler");
    await expect(rnn).toBeVisible();
    await rnn.check();
    await lev.check();
    await page.getByRole("button", { name: /Apply|Process/ }).first().click();
    // The new track shows up in every panel's track list (the lane list clips long names).
    await expect(page.locator("option", { hasText: "· processed" }).first()).toBeAttached({ timeout: 60_000 });

    // Audio Tools → Stretch.
    const toolDrawer = page.getByRole("button", { name: /^Tool:/ });
    await toolDrawer.click();
    await page.getByRole("button", { name: /^•?\s*Stretch$/ }).click();
    // The tool's own track picker mounted before the import → choose the track.
    const pickTrack = async () => {
      const sel = page.locator("select").filter({ has: page.locator("option", { hasText: "Select track…" }) }).first();
      await sel.selectOption({ label: "voice.wav" });
    };
    await pickTrack();
    await page.getByRole("button", { name: /Stretch → new track/ }).click();
    await expect(page.locator("option", { hasText: /Stretched 1\.00×/ }).first()).toBeAttached({ timeout: 60_000 });

    // Audio Tools → Audiogram → render → send to the Media Bucket.
    await toolDrawer.click();
    await page.getByRole("button", { name: /^•?\s*Audiogram$/ }).click();
    await pickTrack();
    await page.getByRole("button", { name: /Render audiogram video/ }).click();
    await expect(page.getByRole("link", { name: "Open" })).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: /→ Media Bucket/ }).click();
    await expect(page.getByRole("button", { name: /In Media Bucket/ })).toBeVisible();

    // Multitrack mixdown in FLAC.
    const fmt = page.locator("select").filter({ has: page.locator('option[value="flac"]') }).first();
    await fmt.selectOption("flac");
    await page.getByRole("button", { name: /Mix down → FLAC/ }).click();
    await expect(page.getByRole("link", { name: /Download FLAC/ })).toBeVisible({ timeout: 60_000 });
  });
});
