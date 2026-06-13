import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedKycStatus,
  seedBannerTtl,
} from "../helpers/playwright-utils";

// USDX-175: the VERIFIED banner on /mint is transient (auto-hide after TTL) and
// once-per-user (localStorage seen flag). Other states stay permanent; the /kyc
// banner is untouched.

type Status = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
const VERIFIED_TEXT = "Your identity is verified";
const banner = (page: Page) => page.getByTestId("kyc-status-section");

async function gotoMint(
  page: Page,
  status: Status,
  opts: { ttlMs?: number; userId?: string } = {},
) {
  await forceEnglish(page);
  await seedKycStatus(page, status);
  if (opts.ttlMs) await seedBannerTtl(page, opts.ttlMs);
  await loginViaStorage(page, {
    kycStatus: status,
    ...(opts.userId ? { id: opts.userId } : {}),
  });
  await page.goto("/mint");
}

test.describe("KYC VERIFIED banner auto-hide (/mint)", () => {
  test.describe("positive", () => {
    test("VERIFIED banner shows on first visit then auto-hides after the TTL", async ({
      page,
    }) => {
      await gotoMint(page, "VERIFIED", { ttlMs: 1000 });
      await expect(banner(page)).toContainText(VERIFIED_TEXT, { timeout: 15000 });
      await expect(banner(page)).toBeHidden();
    });
  });

  test.describe("negative", () => {
    test("does not show again on a later visit once seen", async ({ page }) => {
      await gotoMint(page, "VERIFIED");
      await expect(banner(page)).toContainText(VERIFIED_TEXT, { timeout: 15000 });

      // Revisit: the seen flag is already set, so the banner never renders.
      await page.goto("/mint");
      await expect(banner(page)).toHaveCount(0);
    });

    test("PENDING banner stays permanent (no auto-hide)", async ({ page }) => {
      await gotoMint(page, "PENDING", { ttlMs: 500 });
      await expect(banner(page)).toContainText("Verification in review", {
        timeout: 15000,
      });
      // Past the (short) TTL window the PENDING banner is still there.
      await page.waitForTimeout(1000);
      await expect(banner(page)).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("the seen flag is per user — a different VERIFIED user sees it once", async ({
      page,
    }) => {
      await gotoMint(page, "VERIFIED", { userId: "usr_1" });
      await expect(banner(page)).toContainText(VERIFIED_TEXT, { timeout: 15000 });
      await page.goto("/mint");
      await expect(banner(page)).toHaveCount(0);

      // Switch to another verified user in the same browser context.
      await loginViaStorage(page, { id: "usr_2", kycStatus: "VERIFIED" });
      await page.goto("/mint");
      await expect(banner(page)).toContainText(VERIFIED_TEXT, { timeout: 15000 });
    });

    test("navigating away before the TTL: no console errors, banner gone next visit", async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (e) => consoleErrors.push(String(e)));
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });

      await gotoMint(page, "VERIFIED"); // default 5s TTL — timer still pending
      await expect(banner(page)).toContainText(VERIFIED_TEXT, { timeout: 15000 });
      await page.goto("/redeem"); // unmounts KycStatusSection before the timer fires
      await page.goto("/mint");
      await expect(banner(page)).toHaveCount(0);

      const unmountErrors = consoleErrors.filter((e) =>
        /unmount|memory leak|update a component/i.test(e),
      );
      expect(unmountErrors).toEqual([]);
    });

    test("/kyc VERIFIED banner is untouched", async ({ page }) => {
      await forceEnglish(page);
      await seedKycStatus(page, "VERIFIED");
      await loginViaStorage(page, { kycStatus: "VERIFIED" });
      await page.goto("/kyc");
      await expect(page.getByText(VERIFIED_TEXT)).toBeVisible({ timeout: 15000 });
    });
  });
});
