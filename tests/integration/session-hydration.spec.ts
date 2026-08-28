import { test, expect, type Page } from "@playwright/test";
import {
  clearAuth,
  forceEnglish,
  loginViaStorage,
  seedKycStatus,
  seedMeDelay,
} from "../helpers/playwright-utils";

// The user object is no longer persisted (only `isAuthenticated` is), so on every
// cold load the app knows it has a session but not yet WHO. These specs pin the
// behaviour of that window: wait and show skeletons, never redirect, never render a
// verdict about the customer.
//
// `seedMeDelay` stretches the /v2/auth/me round trip so the window is observable
// instead of a 200ms race.
const ME_DELAY_MS = 4000;

// Web-first assertions auto-retry, so `toHaveCount(0)` would quietly pass the moment
// a wrongly-rendered element disappeared. "Never appeared" needs hard snapshots.
async function countNow(page: Page, testId: string): Promise<number> {
  return page.getByTestId(testId).count();
}

async function coldLoad(page: Page, path: string) {
  await forceEnglish(page);
  await seedMeDelay(page, ME_DELAY_MS);
  await loginViaStorage(page);
  await page.goto(path);
}

test.describe("Session hydration (no persisted user)", () => {
  test.describe("positive", () => {
    test("the loading window shows a skeleton, not the login screen", async ({
      page,
    }) => {
      await coldLoad(page, "/mint");

      // A skeleton stands in for the name that has not arrived yet…
      await expect(page.getByTestId("session-name-skeleton").first()).toBeVisible({
        timeout: 15000,
      });
      // …and the customer is still on /mint, not bounced to /login mid-load.
      expect(new URL(page.url()).pathname).toBe("/mint");
      expect(await page.getByRole("button", { name: "Login" }).count()).toBe(0);

      // Once /auth/me answers, the real identity replaces the skeleton.
      await expect(page.getByText("Demo User").first()).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByTestId("session-name-skeleton")).toHaveCount(0);
    });

    test("/profile renders field skeletons while the session loads, then the data", async ({
      page,
    }) => {
      await coldLoad(page, "/profile");

      await expect(page.getByTestId("profile-field-skeleton").first()).toBeVisible({
        timeout: 15000,
      });
      // No placeholder verdict while waiting — "-" or a defaulted "Unverified" badge
      // states something about the customer the app does not yet know.
      let samples = 0;
      while ((await countNow(page, "profile-field-skeleton")) > 0) {
        expect(await page.getByText("Unverified").count()).toBe(0);
        samples++;
        await page.waitForTimeout(100);
      }
      expect(samples).toBeGreaterThan(3);

      await expect(page.getByText("demo@usdx.com")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("profile-field-skeleton")).toHaveCount(0);
    });
  });

  test.describe("negative", () => {
    // The defect this change is most at risk of introducing, and the worst one: a
    // legitimate, email-verified customer thrown at the verification gate purely
    // because their data had not arrived yet.
    test("a verified customer is NEVER shown the email-verification gate while loading", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedMeDelay(page, ME_DELAY_MS);
      await seedKycStatus(page, "UNVERIFIED");
      await loginViaStorage(page); // demo user — emailVerifiedAt is set
      await page.goto("/kyc");

      // Reaching the skeleton proves we are inside the unknown window (and that the
      // gate did not win the race to render).
      await expect(page.getByTestId("kyc-page-skeleton")).toBeVisible({
        timeout: 15000,
      });

      // Snapshot the gate on every tick for as long as the window lasts.
      let samples = 0;
      while ((await countNow(page, "kyc-page-skeleton")) > 0) {
        expect(await countNow(page, "kyc-email-gate")).toBe(0);
        expect(new URL(page.url()).pathname).toBe("/kyc");
        samples++;
        await page.waitForTimeout(100);
      }
      expect(samples).toBeGreaterThan(3);

      // And after the wait the customer reaches the real KYC page.
      await expect(
        page.getByRole("heading", { name: "Identity Verification" }),
      ).toBeVisible({ timeout: 15000 });
      expect(await countNow(page, "kyc-email-gate")).toBe(0);
    });

    test("an unverified customer still gets the gate once the session is known", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedKycStatus(page, "UNVERIFIED");
      await loginViaStorage(page, { emailVerifiedAt: null });
      await page.goto("/kyc");

      await expect(page.getByTestId("kyc-email-gate")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("edge cases", () => {
    test("without a session the dashboard still redirects to /login", async ({
      page,
    }) => {
      await forceEnglish(page);
      await page.goto("/login");
      await clearAuth(page);
      await page.goto("/mint");
      await expect(page).toHaveURL(/\/login$/);
    });
  });
});
