import { expect, type Page, test } from "@playwright/test";

async function waitForCanvas(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Loading your stash...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator(".react-flow")).toBeVisible();
}

test.describe("production smoke", () => {
  test("loads the canvas empty state", async ({ page }) => {
    await waitForCanvas(page);
    await expect(page.getByText("stash")).toBeVisible();
    await expect(
      page.getByText("Click anywhere to add your first item")
    ).toBeVisible();
  });

  test("creates and persists an item", async ({ page }) => {
    await waitForCanvas(page);

    await page
      .locator(".react-flow__pane")
      .click({ position: { x: 400, y: 300 } });
    await page.getByLabel("Item name").fill("Smoke test item");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Smoke test item")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Loading your stash...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByText("Smoke test item")).toBeVisible();
  });
});
