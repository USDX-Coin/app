import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  seedTwoFactor,
  seedOutboundLock,
  seedLegacyStepUp,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
  MOCK_PIN,
  MOCK_TOTP_CODE,
  MOCK_BACKUP_CODES,
} from "../helpers/playwright-utils";

// 2FA on custodial transfers (custodial-wallet.md §6.1, wallet.yaml, USDX-717). The
// mock plays backend USDX-718: PIN + authenticator code in the same body, 2FA must
// be on, money out is held 24 hours after the second factor was turned off/changed.
// `seedLegacyStepUp` plays the backend BEFORE 718 (the field is dropped) — the FE
// ships first, so it must keep working there.
const TO = "0xabcdef1234567890abcdef1234567890abcdef12";

async function fillForm(page: Page) {
  await page.goto("/send");
  await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("0", { exact: true }).fill("25");
  await page.getByPlaceholder("0x5DC489Ad05Efc").fill(TO);
}

async function openPinDialog(page: Page) {
  await fillForm(page);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Transaction Summary")).toBeVisible();
  await page.getByRole("button", { name: "Continue to PIN" }).click();
  const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
  await expect(pin).toBeVisible();
  return pin;
}

async function asTwoFactorUser(page: Page) {
  await forceEnglish(page);
  await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
  await seedTwoFactor(page, true);
  await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY, twoFactorEnabled: true });
}

test.describe("Transfer — 2FA step-up", () => {
  test.describe("positive", () => {
    test.beforeEach(async ({ page }) => asTwoFactorUser(page));

    test("PIN + authenticator code → the transfer goes through as before (tracker)", async ({ page }) => {
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      const result = page.getByTestId("transfer-result");
      await expect(result).toBeVisible({ timeout: 15000 });
      await expect(result.getByTestId("transfer-status")).toHaveAttribute("data-status", "CONFIRMED", {
        timeout: 15000,
      });
    });

    test("a backup code through 'Use a backup code' approves the transfer", async ({ page }) => {
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Use a backup code" }).click();
      await pin.getByLabel("Backup code").fill(MOCK_BACKUP_CODES[0]);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("wrong code → message under the code field, PIN still filled; the right code then goes through", async ({
      page,
    }) => {
      await asTwoFactorUser(page);
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByLabel("Authenticator code").fill("000000");
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(pin.getByText(/The authenticator code is wrong/)).toBeVisible({ timeout: 15000 });
      await expect(pin.getByLabel("6-digit PIN")).toHaveValue(MOCK_PIN);

      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });

    test("2FA off → activation card, Send disabled; turning 2FA on here opens the form without a reload", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY, twoFactorEnabled: false });
      await fillForm(page);
      const card = page.getByTestId("transfer-2fa-required");
      await expect(card).toContainText("Turn on 2FA first to send USDX");
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();

      await card.getByRole("button", { name: "Turn on 2FA" }).click();
      const dialog = page.getByTestId("two-factor-enable-dialog");
      await dialog.getByLabel("Password", { exact: true }).fill("Demo1234");
      await dialog.getByRole("button", { name: "Continue" }).click();
      await dialog.getByLabel("6-digit code from the app").fill(MOCK_TOTP_CODE);
      await dialog.getByRole("checkbox", { name: "I have saved my backup codes" }).click();
      await dialog.getByRole("button", { name: "Turn on 2FA" }).click();
      await expect(dialog).toBeHidden({ timeout: 15000 });

      await expect(card).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
    });
  });

  test.describe("edge case", () => {
    test("2FA turned off < 24 h ago → 'on hold until …' banner, Send disabled", async ({ page }) => {
      await asTwoFactorUser(page);
      await seedOutboundLock(page, new Date(Date.now() + 20 * 3_600_000).toISOString());
      await fillForm(page);
      await expect(page.getByTestId("transfer-locked")).toContainText(/on hold until/, { timeout: 15000 });
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    });

    test("the lock lands while the form is open (409) → the dialog closes and the same banner shows", async ({
      page,
    }) => {
      await asTwoFactorUser(page);
      const pin = await openPinDialog(page);
      await page.evaluate((until) => {
        localStorage.setItem("usdx-mock-outbound-lock", JSON.stringify({ until }));
      }, new Date(Date.now() + 20 * 3_600_000).toISOString());
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(pin).toBeHidden({ timeout: 15000 });
      await expect(page.getByTestId("transfer-review-locked")).toContainText(/on hold until/);
      await expect(page.getByRole("button", { name: "Continue to PIN" })).toBeDisabled();
    });

    test("5 wrong codes → the code lockout sentence, not the PIN one", async ({ page }) => {
      await asTwoFactorUser(page);
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      // Five wrong codes burn the `2fa-stepup` attempts; the sixth answer is the lockout.
      for (let i = 0; i < 6; i++) {
        await pin.getByLabel("Authenticator code").fill("000000");
        await pin.getByRole("button", { name: "Send", exact: true }).click();
        await expect(pin.getByRole("button", { name: "Processing..." })).toBeVisible();
        await expect(pin.getByRole("button", { name: "Processing..." })).toHaveCount(0, { timeout: 15000 });
      }
      await expect(pin.getByText(/Too many wrong authenticator codes/)).toBeVisible({ timeout: 15000 });
      await expect(pin.getByText("Too many wrong attempts", { exact: false })).toHaveCount(0);
      await expect(pin.getByLabel("6-digit PIN")).toBeEnabled();
    });

    test("backend before USDX-718 drops the code: the transfer still goes through", async ({ page }) => {
      await asTwoFactorUser(page);
      await seedLegacyStepUp(page);
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });
  });
});
