import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await page.goto("/history");
  await expect(page.getByText("Transaction History")).toBeVisible({
    timeout: 15000,
  });
});

test.describe("History Page", () => {
  test.describe("positive", () => {
    test("displays the mint history table", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible();
      await expect(page.getByText("Minting").first()).toBeVisible();
      // Seeded mint row amount (1,000 USDX).
      await expect(
        page.getByText("1,000", { exact: true }).first()
      ).toBeVisible();
    });

    test("shows a status badge", async ({ page }) => {
      await expect(page.getByText("Completed").first()).toBeVisible();
    });

    test("links the tx hash to the chain block explorer", async ({ page }) => {
      const explorerLink = page
        .locator('a[href*="polygonscan.com/tx/0x"]')
        .first();
      await expect(explorerLink).toBeVisible();
      await expect(explorerLink).toHaveAttribute("target", "_blank");
    });

    test("shows the IDR columns from the SoT history spec", async ({ page }) => {
      await expect(page.getByRole("columnheader", { name: "Subtotal" })).toBeVisible();
      // Neutral header serves both mint (paid) and redeem (received) — USDX-244.
      await expect(page.getByRole("columnheader", { name: "Total", exact: true })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Rate" })).toBeVisible();
    });

    test("shows redeem rows with net payout, status, and burn tx link", async ({ page }) => {
      await page.getByRole("tab", { name: "All Transaction" }).click();
      await page.getByRole("tab", { name: "Redeem", exact: true }).click();
      // Seeded completed redeem: 100 USDX → net Rp 1.547.320 (week3 worked example).
      await expect(page.getByText("Payout complete").first()).toBeVisible();
      await expect(page.getByText("Rp 1.547.320").first()).toBeVisible();
      await expect(page.locator('a[href*="polygonscan.com/tx/0x"]').first()).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("page loads without errors", async ({ page }) => {
      await expect(page.getByText("Transaction History")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("type filter offers Mint and Redeem (W3 enabled)", async ({ page }) => {
      await page.getByRole("tab", { name: "All Transaction" }).click();
      await expect(page.getByRole("tab", { name: "Minting" })).toBeVisible();
      const redeem = page.getByRole("tab", { name: "Redeem", exact: true });
      await expect(redeem).toBeVisible();
      await expect(redeem).toBeEnabled();
    });
  });
});
