import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // A dedicated top-level folder, deliberately outside src/ — vitest's
  // include glob ("src/**/*.{test,spec}.{ts,tsx}") would otherwise also
  // pick up these specs and try to run them with the wrong test runner.
  testDir: "./e2e",
  timeout: 30_000,
  // A single Django dev server (runserver) is not built for concurrent load,
  // and these specs share dev-database state — running them sequentially is
  // what keeps the suite deterministic rather than flaky.
  fullyParallel: false,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:8080",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "python manage.py runserver 127.0.0.1:8010",
      url: "http://127.0.0.1:8010/api/health/",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      // Several spec files each make real login/register calls against this
      // one dev server within a single short run -- the default 5/min "auth"
      // throttle (a deliberate brute-force guard, unrelated to test volume)
      // would otherwise trip partway through the suite. Loosened only for
      // this e2e server process; every other invocation keeps the default.
      env: { ...process.env, DJANGO_AUTH_THROTTLE_RATE: "100/min" },
    },
    {
      command: "npm run dev:frontend",
      url: "http://127.0.0.1:8080",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
