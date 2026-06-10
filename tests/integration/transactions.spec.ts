import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await page.goto("/transactions");
  await expect(page.getByText("Transaction History")).toBeVisible({
    timeout: 15000,
  });
});

test.describe("Transactions Page", () => {
  test.describe("positive", () => {
    test("displays transaction table", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible();
      await expect(
        page.getByText("1,000", { exact: true }).first()
      ).toBeVisible();
    });

    test("shows correct transaction types", async ({ page }) => {
      await expect(page.getByText("Minting").first()).toBeVisible();
      await expect(page.getByText("Redeem").first()).toBeVisible();
    });

    test("shows status badges", async ({ page }) => {
      await expect(page.getByText("Completed").first()).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("page loads without errors", async ({ page }) => {
      await expect(page.getByText("Transaction History")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("network filter lists chain names", async ({ page }) => {
      // Chains are no longer a table column — they live in the network filter.
      await page.getByRole("button", { name: "All Network" }).click();
      await expect(
        page.getByRole("button", { name: "Base", exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Polygon", exact: true })
      ).toBeVisible();
    });
  });
});
