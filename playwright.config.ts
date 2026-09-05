import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    // Same lock, same reason as `playwright.integration.config.ts` — see the long
    // note there. Short version: `next build` reads the developer's gitignored
    // `.env.local`, and a `NEXT_PUBLIC_API_BASE_URL` in it flips `env.useMock` to
    // false, so the build under test talks to the REAL dev backend. Every spec
    // here signs in as `demo@usdx.com` / `Demo1234`, an account that exists only
    // in `mock-api.ts`, and the mock seams these specs seed (`usdx-mock-*`, used
    // by the rate-limit and redeem specs) are read by nothing else. So the suite
    // failed wholesale on a developer machine and passed in CI, which has no
    // `.env.local` — the failures looked like stale selectors, not misconfiguration.
    env: {
      NEXT_PUBLIC_USE_MOCK: "true",
      // The mint handoff spec stubs the prod checkout origin; `.env.local` points
      // it at localhost:3001 for the UI audit.
      NEXT_PUBLIC_CHECKOUT_URL: "https://mint.usdx.co.id",
    },
    // Never adopt a server that happens to be listening on :3000 — it is usually
    // another session's `next dev`, built with different env, and `env` above does
    // not apply to a process we did not start.
    reuseExistingServer: false,
    timeout: 180000,
  },
});
