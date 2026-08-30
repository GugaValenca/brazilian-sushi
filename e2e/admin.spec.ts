import { expect, test } from "../playwright-fixture";

test.describe("Admin order management", () => {
  test("staff signs in, opens an order, and advances its status", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("e2e.staff@example.com");
    await page.getByLabel("Password").fill("StrongPass123!");
    await page.getByRole("button", { name: /Sign In/ }).click();

    await expect(page).toHaveURL(/\/account$/, { timeout: 15_000 });

    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();

    // Search rather than rely on pagination/sort order, since other specs
    // (and prior runs) can leave unrelated orders in the same dev database.
    await page.getByPlaceholder("Search by name, email, or phone").fill("e2e.order@example.com");
    await page.getByRole("button", { name: "Search" }).click();

    const orderRow = page.getByText("E2E Order", { exact: true });
    await expect(orderRow).toBeVisible({ timeout: 10_000 });
    await orderRow.click();

    await expect(page).toHaveURL(/\/admin\/orders\/\d+$/);

    // The order starts "received" (reset by global setup on every run), so
    // the only valid next transition is "Confirm order" -- asserting the
    // button that appears next is the stable, non-flaky signal that the
    // status actually advanced, rather than relying on a transient toast.
    await page.getByRole("button", { name: "Confirm order" }).click();
    await expect(page.getByRole("button", { name: "Start preparing" })).toBeVisible({ timeout: 10_000 });
  });
});
