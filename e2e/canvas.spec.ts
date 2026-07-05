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
    await expect(page.getByLabel("Item name")).toBeVisible();

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

  test("persists node position after drag", async ({ page }) => {
    await page
      .locator(".react-flow__pane")
      .click({ position: { x: 400, y: 300 } });
    await page.getByLabel("Item name").fill("Movable chair");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Movable chair")).toBeVisible();

    const node = page.locator(".react-flow__node");
    const box = await node.boundingBox();
    if (!box) throw new Error("Expected stash node to be visible");

    const positionBefore = await node.evaluate((el) => el.style.transform);

    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 100, { steps: 15 });
    await page.mouse.up();

    const positionAfterDrag = await node.evaluate((el) => el.style.transform);
    expect(positionAfterDrag).not.toBe(positionBefore);

    // Wait for debounced geometry persistence (400ms) plus buffer.
    await page.waitForTimeout(600);

    await page.reload();
    await expect(page.getByText("Loading your stash...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByText("Movable chair")).toBeVisible();

    const positionAfterReload = await node.evaluate((el) => el.style.transform);
    expect(positionAfterReload).toBe(positionAfterDrag);
  });
});
