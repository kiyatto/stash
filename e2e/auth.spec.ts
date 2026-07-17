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
    // Missing token → 404 once sharing is wired; unconfigured env may still
    // show the reserved placeholder. Accept either.
    const heading = page.getByRole("heading", { name: /shared stash|not found/i });
    const notFound = page.getByText(/not found|this page could not be found/i);
    await expect(heading.or(notFound).first()).toBeVisible();
  });
});
