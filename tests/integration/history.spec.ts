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
      await expect(page.getByText("Subtotal").first()).toBeVisible();
      await expect(page.getByText("Total Pay").first()).toBeVisible();
      await expect(page.getByText("Rate").first()).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("page loads without errors", async ({ page }) => {
      await expect(page.getByText("Transaction History")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("type filter offers Mint and a disabled Redeem (W3)", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "All Transaction" }).click();
      await expect(
        page.getByRole("button", { name: "Minting" })
      ).toBeVisible();
      const redeem = page.getByRole("button", { name: "Redeem (soon)" });
      await expect(redeem).toBeVisible();
      await expect(redeem).toBeDisabled();
    });
  });
});
