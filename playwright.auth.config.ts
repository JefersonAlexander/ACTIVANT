import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// El entorno del proceso reemplaza explícitamente los valores locales por fixtures.
export default defineConfig({
  ...base,
  outputDir: "test-results/auth",
  testMatch: ["**/auth.spec.ts", "**/dashboard.spec.ts", "**/reservations.spec.ts", "**/attendance.spec.ts", "**/program.spec.ts", "**/waitlist.spec.ts", "**/library-admin.spec.ts"],
  testIgnore: [],
  workers: 2,
  expect: { timeout: 15_000 },
  webServer: [
    { command: "node tests/fixtures/supabase-mock.mjs", url: "http://127.0.0.1:54322/health", reuseExistingServer: false },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000/login",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        APP_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54322",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only_not_a_real_key",
        SUPABASE_SECRET_KEY: "sb_secret_fixture_only_not_a_real_key",
        APP_URL: "http://127.0.0.1:3000",
      },
    },
  ],
});
