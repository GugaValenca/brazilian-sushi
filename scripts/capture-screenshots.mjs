// One-off capture tool for the README screenshots in docs/screenshots/.
// Not part of any automated test suite — run manually against the app
// running locally (npm run dev:frontend + npm run dev:backend) whenever the
// UI changes enough to warrant refreshed screenshots:
//
//   node scripts/capture-screenshots.mjs
//
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "docs", "screenshots");
const baseUrl = "http://127.0.0.1:8080";

const CUSTOMER = { email: "screenshot.customer@example.com", password: "StrongPass123!" };
const STAFF = { email: "screenshot.staff@example.com", password: "StrongPass123!" };

function provisionDemoAccounts() {
  const script = `
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

customer, _ = User.objects.get_or_create(
    email="${CUSTOMER.email}",
    defaults={"username": "screenshotcustomer", "first_name": "Ava", "last_name": "Customer"},
)
customer.set_password("${CUSTOMER.password}")
customer.is_active = True
customer.account_confirmed_at = timezone.now()
customer.is_verified_customer = True
customer.save()

staff, _ = User.objects.get_or_create(
    email="${STAFF.email}",
    defaults={"username": "screenshotstaff", "first_name": "Jordan", "last_name": "Staff"},
)
staff.set_password("${STAFF.password}")
staff.is_active = True
staff.is_staff = True
staff.account_confirmed_at = timezone.now()
staff.save()

print("ACCOUNTS_READY")
`;
  const output = execFileSync("python", ["manage.py", "shell"], {
    cwd: repoRoot,
    input: script,
    encoding: "utf-8",
  });
  if (!output.includes("ACCOUNTS_READY")) {
    throw new Error(`Failed to provision demo accounts:\n${output}`);
  }
}

async function loginAs(page, { email, password }) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign In/ }).click();
  await page.waitForURL(/\/account$/, { timeout: 15_000 });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  provisionDemoAccounts();

  const browser = await chromium.launch();

  // A fresh browser context per section — rather than one page reused
  // throughout — keeps each capture's auth state fully isolated, the same
  // way a real visitor's guest session and a staff member's session would
  // never share one browser profile.
  async function withPage(run) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      await run(page);
    } finally {
      await context.close();
    }
  }

  console.log("Capturing home page...");
  await withPage(async (page) => {
    await page.goto(baseUrl);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(outDir, "home-page.png") });
  });

  console.log("Capturing menu and checkout pages...");
  await withPage(async (page) => {
    await page.goto(`${baseUrl}/menu`);
    const firstAddToCart = page.getByRole("button", { name: "Add to Cart" }).first();
    await firstAddToCart.waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(400); // let the reveal animation settle
    await page.screenshot({ path: path.join(outDir, "menu-page.png") });

    await firstAddToCart.click();
    await page.goto(`${baseUrl}/checkout`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(outDir, "checkout-page.png") });
  });

  console.log("Capturing account page...");
  await withPage(async (page) => {
    await loginAs(page, CUSTOMER);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(outDir, "account-page.png") });
  });

  console.log("Capturing staff dashboard...");
  await withPage(async (page) => {
    await loginAs(page, STAFF);
    await page.goto(`${baseUrl}/staff-dashboard`);
    await page.getByText("Live Order Queue").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(600); // let the revenue chart finish rendering
    await page.screenshot({ path: path.join(outDir, "staff-dashboard.png") });
  });

  await browser.close();
  console.log(`Done. Screenshots saved to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
