import { expect, test } from "../playwright-fixture";

test.describe("Guest checkout", () => {
  test("adds an item to the cart and completes pickup checkout as a guest", async ({ page }) => {
    await page.goto("/menu");

    const firstAddToCart = page.getByRole("button", { name: "Add to Cart" }).first();
    await expect(firstAddToCart).toBeVisible({ timeout: 15_000 });
    await firstAddToCart.click();

    await page.goto("/checkout");

    // Pickup skips delivery-zone selection entirely, keeping this spec
    // independent of whatever delivery zones happen to be seeded.
    await page.getByRole("button", { name: /^Pickup/ }).click();

    await page.getByLabel("Full Name").fill("Playwright Guest");
    await page.getByLabel("Phone Number").fill("8135550199");
    await page.getByLabel("Email Address").fill("playwright.guest@example.com");

    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/track-order\?order=\d+&token=/, { timeout: 15_000 });
    await expect(page.getByText(/^Order #\d+$/)).toBeVisible();
  });
});
