import { test, expect } from "@playwright/test";
import { loginViaStorage } from "../helpers/playwright-utils";

test.beforeEach(async ({ page }) => {
  await loginViaStorage(page);
  await page.goto("/mint");
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
});

test.describe("Mint Page", () => {
  test.describe("positive", () => {
    test("displays mint form with default chain", async ({ page }) => {
      await expect(page.getByText("USDX on Base")).toBeVisible();
      await expect(page.getByPlaceholder("Amount").first()).toBeVisible();
      await expect(
        page.getByPlaceholder("Destination Address")
      ).toBeVisible();
    });

    test("Review Mint enabled when form is valid", async ({ page }) => {
      await page.getByPlaceholder("Amount").first().fill("100");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await expect(
        page.getByRole("button", { name: "Review Mint" })
      ).toBeEnabled();
    });

    test("shows review panel with correct data", async ({ page }) => {
      await page.getByPlaceholder("Amount").first().fill("500");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await page.getByRole("button", { name: "Review Mint" }).click();
      await expect(page.getByText("Mint Detail")).toBeVisible();
      await expect(page.getByText("500 USDX")).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("Review Mint disabled when form is empty", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Review Mint" })
      ).toBeDisabled();
    });

    test("shows min amount error", async ({ page }) => {
      await page.getByPlaceholder("Amount").first().fill("1");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await expect(page.getByText(/Minimum/)).toBeVisible();
    });

    test("shows max amount error", async ({ page }) => {
      await page.getByPlaceholder("Amount").first().fill("9999999");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await expect(page.getByText(/Maximum/)).toBeVisible();
    });

    test("shows invalid address error", async ({ page }) => {
      await page.getByPlaceholder("Amount").first().fill("100");
      await page
        .getByPlaceholder("Destination Address")
        .fill("notanaddress");
      await expect(page.getByText(/Invalid|must start with 0x/)).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("auto-calculates payment amount", async ({ page }) => {
      await page.getByPlaceholder("Amount").first().fill("1000");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await page.getByRole("button", { name: "Review Mint" }).click();
      // 0.7% fee of 1000 = $7
      await expect(page.getByText("$7")).toBeVisible();
      // Total payment section shows
      await expect(page.getByText("Total payment")).toBeVisible();
    });

    test("chain selector dialog opens", async ({ page }) => {
      await page.getByText("USDX on Base").click();
      await expect(page.getByText("Select Network")).toBeVisible();
    });
  });
});
