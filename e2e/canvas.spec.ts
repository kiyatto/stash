import { expect, type Page, test } from "@playwright/test";

async function waitForCanvas(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Loading your stash...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator(".react-flow")).toBeVisible();
}

test.describe("stash canvas", () => {
  test.beforeEach(async ({ page }) => {
    await waitForCanvas(page);
  });

  test("shows the empty-state hint on first load", async ({ page }) => {
    await expect(page.getByText("stash")).toBeVisible();
    await expect(page.getByText("Unsaved · kept 7 days")).toBeVisible();
    await expect(
      page.getByText("Click anywhere to add your first item")
    ).toBeVisible();
  });

  test("creates an item from the canvas and modal", async ({ page }) => {
    await page
      .locator(".react-flow__pane")
      .click({ position: { x: 400, y: 300 } });

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("New stash item")).toBeVisible();

    await page.getByLabel("Item name").fill("Reading chair");
    await page.getByLabel("Link").fill("https://example.com/chair");
    await page.getByLabel("Notes").fill("Velvet upholstery");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Reading chair")).toBeVisible();
    await expect(page.getByText("Velvet upholstery")).toBeVisible();
    await expect(
      page.getByText("Click anywhere to add your first item")
    ).toBeHidden();
  });

  test("edits and deletes an existing item", async ({ page }) => {
    await page
      .locator(".react-flow__pane")
      .click({ position: { x: 400, y: 300 } });
    await page.getByLabel("Item name").fill("Desk lamp");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Desk lamp")).toBeVisible();

    await page.locator(".react-flow__node").click();
    await expect(page.getByText("Edit stash item")).toBeVisible();

    await page.getByLabel("Item name").fill("Updated lamp");
    await page.getByLabel("Notes").fill("Brass finish");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Updated lamp")).toBeVisible();
    await expect(page.getByText("Brass finish")).toBeVisible();

    await page.locator(".react-flow__node").click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Updated lamp")).toBeHidden();
    await expect(
      page.getByText("Click anywhere to add your first item")
    ).toBeVisible();
  });

  test("cancels create without saving changes", async ({ page }) => {
    await page
      .locator(".react-flow__pane")
      .click({ position: { x: 400, y: 300 } });
    await page.getByLabel("Item name").fill("Temporary item");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Temporary item")).toBeHidden();
  });

  test("persists items after a page reload", async ({ page }) => {
    await page
      .locator(".react-flow__pane")
      .click({ position: { x: 400, y: 300 } });
    await page.getByLabel("Item name").fill("Persisted vase");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Persisted vase")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Loading your stash...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByText("Persisted vase")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Click anywhere to add your first item")
    ).toBeHidden();
  });
});
