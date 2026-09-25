import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  seedTwoFactor,
  seedOutboundLock,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
  MOCK_PIN,
  MOCK_TOTP_CODE,
} from "../helpers/playwright-utils";

// 2FA on custodial redeem (custodial-wallet.md §6.1, redeem.yaml, USDX-717) — the
// same rules as the transfer: code under the PIN, activation card, 24-hour lock
// banner. The external (self-sign) source is untouched.
async function fillForm(page: Page) {
  await page.goto("/redeem");
  await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("redeem-custodial-source")).toContainText("500 USDX", { timeout: 15000 });
  await page.getByPlaceholder("0", { exact: true }).fill("100");
  await page.getByRole("combobox", { name: "Select bank" }).click();
  await page.getByText("BCA", { exact: true }).click();
  await page.getByPlaceholder("1234567890").fill("1234563210");
  await page.getByPlaceholder("As printed on the passbook").fill("SINGGIH BRILIAN TARA");
}

async function openPinDialog(page: Page) {
  await fillForm(page);
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  await page.getByRole("button", { name: "Continue to Confirmation" }).click();
  const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
  await expect(pin).toBeVisible();
  return pin;
}

async function asUser(page: Page, twoFactorEnabled: boolean) {
  await forceEnglish(page);
  await seedCustodialWallet(page, { status: "ACTIVE", balance: "500.00" });
  await seedTwoFactor(page, twoFactorEnabled);
  await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY, twoFactorEnabled });
}

test.describe("Redeem (custodial) — 2FA step-up", () => {
  test.describe("positive", () => {
    test("PIN + authenticator code → the order is created and the system burns", async ({ page }) => {
      await asUser(page, true);
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Confirm & Burn" }).click();
      await expect(page.getByTestId("redeem-custodial-processing")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("wrong code stays under the code field — no logout, no order, PIN kept", async ({ page }) => {
      await asUser(page, true);
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByLabel("Authenticator code").fill("000000");
      await pin.getByRole("button", { name: "Confirm & Burn" }).click();
      await expect(pin.getByText(/The authenticator code is wrong/)).toBeVisible({ timeout: 15000 });
      await expect(pin.getByLabel("6-digit PIN")).toHaveValue(MOCK_PIN);
      await expect(page).toHaveURL(/\/redeem/);
    });

    test("2FA off → activation card on the custodial source, Redeem disabled", async ({ page }) => {
      await asUser(page, false);
      await fillForm(page);
      await expect(page.getByTestId("redeem-2fa-required")).toContainText("Turn on 2FA first to withdraw");
      await expect(page.getByRole("button", { name: "Redeem", exact: true })).toBeDisabled();
    });
  });

  test.describe("edge case", () => {
    test("24-hour lock → 'on hold until …' banner, Redeem disabled", async ({ page }) => {
      await asUser(page, true);
      await seedOutboundLock(page, new Date(Date.now() + 20 * 3_600_000).toISOString());
      await fillForm(page);
      await expect(page.getByTestId("redeem-locked")).toContainText(/on hold until/, { timeout: 15000 });
      await expect(page.getByRole("button", { name: "Redeem", exact: true })).toBeDisabled();
    });

    test("the external source is not held by the 2FA card", async ({ page }) => {
      await asUser(page, false);
      await fillForm(page);
      await page.getByTestId("redeem-source-external").click();
      await expect(page.getByTestId("redeem-2fa-required")).toHaveCount(0);
    });
  });
});
