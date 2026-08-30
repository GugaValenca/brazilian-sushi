import { expect, test } from "../playwright-fixture";

test.describe("Account addresses", () => {
  test("switches the default address with the Make Default button", async ({ page }) => {
    await page.goto("/login");

    // Seeded by global-setup.ts with two addresses: "Primary" (default) and
    // "Secondary" (not) -- a customer dedicated to this test so its mutation
    // (flipping which address is_default) never affects other specs.
    await page.getByLabel("Email").fill("e2e.address.customer@example.com");
    await page.getByLabel("Password").fill("StrongPass123!");
    await page.getByRole("button", { name: /Sign In/ }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 15_000 });

    // Scoped to the Saved Addresses section and its card class so this
    // doesn't accidentally match an unrelated card elsewhere on the page.
    const addressesSection = page.locator("section", { hasText: "Saved Addresses" });
    const secondaryCard = addressesSection.locator("div.rounded-xl", { hasText: "Secondary" });
    await secondaryCard.getByRole("button", { name: "Make default" }).click();

    // The card now shows the "Default" badge instead of a "Make default"
    // button, and "Primary" gets the button back.
    await expect(secondaryCard.getByText("Default", { exact: true })).toBeVisible({ timeout: 10_000 });
    const primaryCard = addressesSection.locator("div.rounded-xl", { hasText: "Primary" });
    await expect(primaryCard.getByRole("button", { name: "Make default" })).toBeVisible();
  });
});
