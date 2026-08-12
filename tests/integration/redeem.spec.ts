import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage, forceEnglish, seedWallet } from "../helpers/playwright-utils";

// Redeem page (USDX-243): form (USD/IDR toggle + inline bank) -> contextual
// wallet connect -> Ringkasan modal -> burn -> status tracker.
// Phase 2 = Polygon-only; live sell rate from GET /v2/rate (mock 15,680).
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await seedWallet(page); // contextual connect resolves to a mock address offline
  await loginViaStorage(page);
  await page.goto("/redeem");
  await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
});

async function fillForm(page: Page, amount = "100") {
  await page.getByPlaceholder("0", { exact: true }).fill(amount);
  await page.getByRole("button", { name: "Select bank" }).click();
  await page.getByText("BCA", { exact: true }).click();
  await page.getByPlaceholder("Enter account number").fill("1234563210");
  await page.getByPlaceholder("Enter holder name").fill("SINGGIH BRILIAN TARA");
}

test.describe("Redeem Page", () => {
  test.describe("positive", () => {
    test("shows the form locked to Polygon with the live sell rate", async ({ page }) => {
      await expect(page.getByText("1 USDX ≈ 15,680 IDR")).toBeVisible();
      await expect(page.locator('img[src="/icon/polygon.svg"]').first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Select bank" })).toBeVisible();
    });

    test("previews the fee breakdown and net payout", async ({ page }) => {
      await fillForm(page);
      await expect(page.getByText("You will receive")).toBeVisible();
      // 100 USDX → net Rp 1.547.320 (week3.md worked example).
      await expect(page.getByText("Rp 1.547.320")).toBeVisible();
    });

    test("Redeem triggers the contextual connect, then opens the Ringkasan", async ({ page }) => {
      await fillForm(page);
      // SoT: the CTA is always "Redeem" — first click connects (seam), second
      // click (now connected) opens the Ringkasan.
      const redeem = page.getByRole("button", { name: "Redeem", exact: true });
      await expect(redeem).toBeEnabled();
      await redeem.click();
      await redeem.click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("100 USDX").first()).toBeVisible();
      await expect(page.getByText(/Burn USDX cannot be undone/)).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("Redeem disabled when the form is empty", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Redeem", exact: true })).toBeDisabled();
    });

    test("shows the min amount error", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("1");
      await expect(page.getByText("Minimum amount is 10 USDX")).toBeVisible();
    });

    test("no global connect-wallet button on the page chrome", async ({ page }) => {
      // Connect is contextual — there's no standalone connect button anywhere;
      // it only opens (RainbowKit / seam) when "Redeem" is clicked (W2 principle).
      await expect(page.getByRole("button", { name: "Connect Wallet" })).toHaveCount(0);
    });
  });

  test.describe("edge cases", () => {
    test("toggles the amount denomination USD ↔ IDR", async ({ page }) => {
      await expect(page.getByText("Sale value (IDR)")).toBeVisible();
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByRole("button", { name: "Swap currency" }).click();
      // After the swap the IDR box becomes the editable input (top).
      await expect(page.getByText("You will redeem")).toBeVisible();
    });
  });
});
