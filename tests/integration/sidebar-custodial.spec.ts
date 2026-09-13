import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
} from "../helpers/playwright-utils";

// For a custodial-wallet owner, Send is a real transfer form (USDX-567), so its
// "Coming Soon" pill comes off. Bridge keeps it. Users without a custodial
// wallet are covered by sidebar-nav.spec.ts (pill on both).
test.describe("Sidebar — custodial owner", () => {
  test.describe("positive", () => {
    test("Send loses the Coming Soon pill; Bridge keeps it", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
      const sidebar = page.locator("aside");
      await expect(sidebar.getByRole("link", { name: "Send", exact: true })).toBeVisible();
      await expect(sidebar.getByRole("link", { name: "Send Coming Soon" })).toHaveCount(0);
      await expect(sidebar.getByRole("link", { name: "Bridge Coming Soon" })).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("without a custodial wallet the Send pill stays", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("aside").getByRole("link", { name: "Send Coming Soon" })).toBeVisible();
    });
  });

  test.describe("edge case", () => {
    test("the Send link of a custodial owner lands on the transfer form, not ComingSoon", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
      await page.locator("aside").getByRole("link", { name: "Send", exact: true }).click();
      await expect(page).toHaveURL(/\/send$/);
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("main").getByText("Coming soon", { exact: true })).toHaveCount(0);
    });
  });
});
