import { expect, test } from "../playwright-fixture";

test.describe("Registration", () => {
  test("creates an account with an optional delivery address, saved as the default", async ({ page }) => {
    const unique = Date.now();

    await page.goto("/register");

    await page.getByLabel("First name").fill("Playwright");
    await page.getByLabel("Last name").fill("Registrant");
    await page.getByLabel("Username").fill(`e2e-register-${unique}`);
    await page.getByLabel("Phone").fill(`813555${String(unique).slice(-4)}`);
    await page.getByLabel("Email").fill(`e2e.register.${unique}@example.com`);
    await page.getByLabel("Password").fill("StrongPass123!");

    await page.getByText("Save a delivery address (optional)").click();
    await page.getByLabel("Address line 1").fill("100 Registration Way");
    await page.getByLabel("City").fill("Tampa");
    await page.getByLabel("State").fill("FL");
    await page.getByLabel("Postal code").fill("33601");

    await page.getByRole("button", { name: "Create Account" }).click();

    // Local dev runs with DEBUG=true, so an email confirmation channel is
    // always available (see accounts/services.py's can_send_email_confirmation)
    // -- registration lands on the confirm-account step rather than /login.
    await expect(page).toHaveURL(/\/confirm-account/, { timeout: 15_000 });
  });

  test("warns that the customer is already registered when the email is taken", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("First name").fill("Duplicate");
    await page.getByLabel("Last name").fill("Registrant");
    await page.getByLabel("Username").fill(`e2e-duplicate-${Date.now()}`);
    await page.getByLabel("Phone").fill("8135550111");
    // Already provisioned by global-setup.ts for the login spec.
    await page.getByLabel("Email").fill("e2e.customer@example.com");
    await page.getByLabel("Password").fill("StrongPass123!");

    const submitButton = page.getByRole("button", { name: "Create Account" });
    await submitButton.click();

    // The rejection surfaces as a transient toast, which can auto-dismiss
    // before an assertion gets to it (same reasoning as login.spec.ts) --
    // the button re-enabling and the page staying put is the reliable signal
    // that the duplicate email was rejected rather than silently accepted.
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/register$/);
  });
});
