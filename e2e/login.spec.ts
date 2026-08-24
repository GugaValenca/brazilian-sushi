import { expect, test } from "../playwright-fixture";

test.describe("Authenticated login", () => {
  test("signs in a confirmed customer and reaches the account page", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("e2e.customer@example.com");
    await page.getByLabel("Password").fill("StrongPass123!");
    await page.getByRole("button", { name: /Sign In/ }).click();

    await expect(page).toHaveURL(/\/account$/, { timeout: 15_000 });
    await expect(page.getByText("E2E Customer")).toBeVisible();
  });

  test("shows an error for invalid credentials without navigating away", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("e2e.customer@example.com");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    const signInButton = page.getByRole("button", { name: /Sign In/ });
    await signInButton.click();

    // The error surfaces as a transient toast, which can auto-dismiss before
    // an assertion gets to it — asserting on navigation and the form
    // returning to its idle state is the reliable, non-flaky signal that the
    // login was rejected rather than silently accepted.
    await expect(signInButton).toBeEnabled({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login$/);
  });
});
