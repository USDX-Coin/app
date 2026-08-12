import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
// Seeded address-book entry (mock) — "Demo Wallet".
const SEEDED_ADDRESS = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

// Mint flow (USDX-201): form -> Ringkasan modal -> checkout redirect.
// Phase 2 = Polygon-only; live rate from GET /v2/rate (mock effectiveBuyRate 16,400).
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await page.goto("/mint");
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
});

test.describe("Mint Page", () => {
  test.describe("positive", () => {
    test("displays mint form locked to Polygon with the live rate", async ({ page }) => {
      await expect(page.getByText("You will pay")).toBeVisible();
      await expect(page.getByPlaceholder("0", { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder("Select destination address")).toBeVisible();
      // Chain is locked to Polygon — its badge shows on the USDX chip.
      await expect(page.locator('img[src="/icon/polygon.svg"]').first()).toBeVisible();
      await expect(page.getByText("1 USDX ≈ 16,400 IDR")).toBeVisible();
    });

    test("Mint button enabled when form is valid", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByPlaceholder("Select destination address").fill(VALID_ADDRESS);
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeEnabled();
    });

    test("opens the Ringkasan modal with correct data", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("500");
      await page.getByPlaceholder("Select destination address").fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("500 USDX").first()).toBeVisible();
    });

    test("picks a destination from the address book", async ({ page }) => {
      await page.getByRole("button", { name: "Add address book" }).click();
      await expect(page.getByRole("heading", { name: "Address book" })).toBeVisible();
      await page.getByText("Demo Wallet").click();
      await expect(page.getByPlaceholder("Select destination address")).toHaveValue(SEEDED_ADDRESS);
    });
  });

  test.describe("negative", () => {
    test("Mint button disabled when form is empty", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });

    test("shows min amount error", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("1");
      await page.getByPlaceholder("Select destination address").fill(VALID_ADDRESS);
      await expect(page.getByText("Minimum amount is 10 USDX")).toBeVisible();
    });

    test("shows max amount error", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("9999999");
      await page.getByPlaceholder("Select destination address").fill(VALID_ADDRESS);
      await expect(page.getByText("Maximum amount is 1,000,000 USDX")).toBeVisible();
    });

    test("keeps Mint disabled for an invalid address", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByPlaceholder("Select destination address").fill("notanaddress");
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });

    test("shows inline error and stays on /mint when recipient is blacklisted (422)", async ({ page }) => {
      // Sentinel address the mock rejects with 422 RECIPIENT_BLACKLISTED (mirrors BE pre-check).
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page
        .getByPlaceholder("Select destination address")
        .fill("0x000000000000000000000000000000000000dead");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await expect(page.getByText("This destination address can't receive USDX")).toBeVisible();
      await expect(page).toHaveURL(/\/mint$/);
    });
  });

  test.describe("edge cases", () => {
    test("auto-calculates the IDR payment amount", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("1000");
      // 1000 USDX × 16,400 IDR
      await expect(page.getByText("16,400,000")).toBeVisible();
      await expect(page.getByText("You will pay")).toBeVisible();
    });
  });
});
