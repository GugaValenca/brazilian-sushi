// Captures docs/screenshots/staff-dashboard.png on its own. Split out from
// capture-screenshots.mjs (which calls this as a separate process) because
// this is the one heavy page (React.lazy + recharts) and it loads far more
// reliably as the only thing a fresh browser process has done, rather than
// as the last of several page loads in one long-lived process.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "screenshots");
const baseUrl = "http://127.0.0.1:8080";
const STAFF = { email: "screenshot.staff@example.com", password: "StrongPass123!" };

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${baseUrl}/login`);
await page.getByLabel("Email").fill(STAFF.email);
await page.getByLabel("Password").fill(STAFF.password);
await page.getByRole("button", { name: /Sign In/ }).click();
await page.waitForURL(/\/account$/, { timeout: 15_000 });

await page.goto(`${baseUrl}/staff-dashboard`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Live Order Queue", { timeout: 30_000 });
await page.waitForTimeout(600); // let the revenue chart finish rendering
await page.screenshot({ path: path.join(outDir, "staff-dashboard.png") });

await browser.close();
