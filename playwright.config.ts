import { defineConfig, devices } from "@playwright/test";

// PLAYWRIGHT_CHROME=1 reutiliza Google Chrome cuando está instalado.
// Por defecto usa Chromium: npx playwright install chromium.
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/home",
  testIgnore: ["**/auth.spec.ts", "**/dashboard.spec.ts", "**/reservations.spec.ts", "**/attendance.spec.ts", "**/program.spec.ts", "**/waitlist.spec.ts", "**/library-admin.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROME === "1" ? { channel: "chrome" } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
