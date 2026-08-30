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

  test("blocks and then completes a guest delivery order once a street address is entered", async ({ page }) => {
    await page.goto("/menu");

    const firstAddToCart = page.getByRole("button", { name: "Add to Cart" }).first();
    await expect(firstAddToCart).toBeVisible({ timeout: 15_000 });
    await firstAddToCart.click();

    await page.goto("/checkout");

    // Delivery is the default order type -- explicit anyway for clarity.
    await page.getByRole("button", { name: /^Delivery/ }).click();

    await page.getByLabel("Full Name").fill("Playwright Delivery Guest");
    await page.getByLabel("Phone Number").fill("8135550198");
    await page.getByLabel("Email Address").fill("playwright.delivery.guest@example.com");

    await page.locator('button:has-text("min")').first().click();

    // Regression guard for the exact bug this spec exists to catch: without
    // a street address, the order must not be submittable no matter what
    // else is filled in.
    const placeOrderButton = page.getByRole("button", { name: "Place Order" });
    await expect(placeOrderButton).toBeDisabled();

    await page.getByLabel("Address Line 1").fill("742 Evergreen Terrace");
    await page.getByLabel("City").fill("Springfield");
    await page.getByLabel("State").fill("IL");
    await page.getByLabel("Postal Code").fill("62704");
    await page.getByLabel("Delivery Instructions").fill("Gate code 1234, leave at the door.");

    await expect(placeOrderButton).toBeEnabled();
    await placeOrderButton.click();

    await expect(page).toHaveURL(/\/track-order\?order=\d+&token=/, { timeout: 15_000 });
    await expect(page.getByText(/^Order #\d+$/)).toBeVisible();
  });
});
