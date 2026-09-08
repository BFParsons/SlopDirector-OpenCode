import { expect, test } from "@playwright/test";
import { createProject, deleteProject, openEditor } from "./helpers";

test("leaving an untitled, empty project asks to save or discard (in-app dialog)", async ({ page, request }) => {
  const id = await createProject(request, { title: "Untitled video" });
  try {
    await openEditor(page, id);
    // The toolbar logo is the Home button; the guard intercepts in-app navigation.
    await page.getByRole("button", { name: "Home" }).click();
    await expect(page.getByText("Save this project?")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Save this project?")).toHaveCount(0);
    expect(page.url()).toContain(`/projects/${id}`);

    await page.getByRole("button", { name: "Home" }).click();
    await page.getByRole("button", { name: "Discard" }).click();
    await page.waitForURL(/\/start$/);
    const list = await (await request.get("/api/projects")).json();
    expect(list.data.some((p: { id: string }) => p.id === id)).toBeFalsy();
  } finally {
    await deleteProject(request, id);
  }
});
