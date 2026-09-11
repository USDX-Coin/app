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
      await seedCustodialWallet(page);
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
});
