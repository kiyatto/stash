import { expect, test } from "@playwright/test";

test.describe("auth routing", () => {
  test("login page is reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Sign in" })
    ).toBeVisible();
  });

  test("protected routes redirect when unauthenticated", async ({ page }) => {
    await page.goto("/stashes");
    // With Supabase configured → /login?next=…; without → / (anon canvas).
    await expect(page).toHaveURL(/\/(login(\?.*)?)?$/);
  });

  test("share routes stay public", async ({ page }) => {
    await page.goto("/share/example-token");
    await expect(
      page.getByRole("heading", { name: "Shared stash" })
    ).toBeVisible();
    await expect(page.getByText("example-token")).toBeVisible();
  });
});
