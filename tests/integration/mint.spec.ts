import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";

// Mint flow (post-redesign): form -> confirmation -> status.
// Amount input has placeholder "0"; destination input "Select destination address".
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await page.goto("/mint");
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
});

test.describe("Mint Page", () => {
  test.describe("positive", () => {
    test("displays mint form with default chain", async ({ page }) => {
      await expect(page.getByText("You will pay")).toBeVisible();
      await expect(page.getByPlaceholder("0", { exact: true })).toBeVisible();
      await expect(
        page.getByPlaceholder("Select destination address")
      ).toBeVisible();
      // Default chain is Base — its badge icon shows on the token button.
      await expect(page.locator('img[src="/icon/base.svg"]').first()).toBeVisible();
      await expect(page.getByText("1 USDX ≈ 17,010 IDR")).toBeVisible();
    });

    test("Mint button enabled when form is valid", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page
        .getByPlaceholder("Select destination address")
        .fill(VALID_ADDRESS);
      await expect(
        page.getByRole("button", { name: "Mint", exact: true })
      ).toBeEnabled();
    });

    test("shows confirmation panel with correct data", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("500");
      await page
        .getByPlaceholder("Select destination address")
        .fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Mint Confirmation")).toBeVisible();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("500 USDX").first()).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("Mint button disabled when form is empty", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Mint", exact: true })
      ).toBeDisabled();
    });

    test("shows min amount error", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("1");
      await page
        .getByPlaceholder("Select destination address")
        .fill(VALID_ADDRESS);
      await expect(page.getByText("Minimum amount is 10 USDX")).toBeVisible();
    });

    test("shows max amount error", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("9999999");
      await page
        .getByPlaceholder("Select destination address")
        .fill(VALID_ADDRESS);
      await expect(
        page.getByText("Maximum amount is 1,000,000 USDX")
      ).toBeVisible();
    });

    test("keeps Mint disabled for invalid address", async ({ page }) => {
      // Address errors are no longer rendered inline — the form simply stays invalid.
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page
        .getByPlaceholder("Select destination address")
        .fill("notanaddress");
      await expect(
        page.getByRole("button", { name: "Mint", exact: true })
      ).toBeDisabled();
    });
  });

  test.describe("edge cases", () => {
    test("auto-calculates IDR payment amount", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("1000");
      // 1000 USDX * 17,010 IDR
      await expect(page.getByText("17,010,000")).toBeVisible();
      await expect(page.getByText("You will pay")).toBeVisible();
    });

    test("network/token modal opens", async ({ page }) => {
      await page.getByRole("button", { name: "USDX", exact: true }).click();
      await expect(page.getByText("Mint to")).toBeVisible();
      await expect(page.getByText("Selected Network")).toBeVisible();
    });
  });
});
