import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  seedIncomingTransfers,
  INCOMING_TRANSFER_FIXTURES as IN,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
} from "../helpers/playwright-utils";

// Unified /history (USDX-713, custodial-wallet.md §5.7): USDX that comes IN to the
// custodial wallet shows at once as "Waiting for confirmation" and turns "Successful"
// on the open page, without a reload — the list refreshes every 15 s while a PENDING
// transfer is on screen. The mock plays the backend scanner's final pass
// (`seedIncomingTransfers` confirmAfterMs).

test.describe("Unified history flow", () => {
  test.describe("positive", () => {
    test("an incoming transfer flips from waiting to successful on the open page", async ({ page }) => {
      test.setTimeout(60_000);
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await seedIncomingTransfers(page, [IN.pending], { confirmAfterMs: 2_000 });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/history?type=TRANSFER_IN");

      const badge = page.getByTestId("history-transfer-row").getByTestId("transfer-status-badge");
      await expect(badge).toHaveText("Waiting for confirmation", { timeout: 15000 });
      // One refresh interval (15 s) later — same page, no reload.
      await expect(badge).toHaveText("Successful", { timeout: 25000 });
    });
  });

  test.describe("negative", () => {
    test("a user without a custodial wallet sees no transfers, and 'Outgoing' is empty, not an error", async ({
      page,
    }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/history?type=TRANSFER_OUT");

      await expect(page.getByText("Nothing matches this filter")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("history-transfer-row")).toHaveCount(0);
      await page.getByRole("button", { name: "Show all" }).click();
      await expect(page).toHaveURL(/\/history$/);
      await expect(page.getByRole("main").locator("table").getByText("Minting").first()).toBeVisible();
    });
  });

  test.describe("edge case", () => {
    test("an unknown ?type= opens 'All Transaction'", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/history?type=BRIDGE");

      await expect(page.getByRole("tab", { name: "All Transaction" })).toHaveAttribute("aria-selected", "true", {
        timeout: 15000,
      });
    });
  });
});
