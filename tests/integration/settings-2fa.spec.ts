import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  seedTwoFactor,
  MOCK_BACKUP_CODES,
  MOCK_TOTP_CODE,
  VIEWPORTS,
} from "../helpers/playwright-utils";

// Pengaturan → Keamanan → 2FA (custodial-wallet.md §6.1 "Web", two-factor.yaml,
// USDX-714). Runs against the mock backend: the account's 2FA lives in the
// "usdx-mock-two-factor" seam (`seedTwoFactor`), the mock accepts `MOCK_TOTP_CODE`
// as the authenticator's current code.
//
// What these pin, per the ACs: turn on = password → QR + backup codes shown once →
// right code → on (wrong code → still off); turn off shows the 24-hour hold BEFORE
// the confirmation; the profile copy follows at once and a cached /auth/me cannot
// bring the old value back; new backup codes replace the old set.

const row = (page: Page) => page.locator('[data-slot="settings-2fa"]');

async function gotoSettings(page: Page, heading = "Settings") {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 15000 });
}

async function startEnable(page: Page) {
  await row(page).getByRole("button", { name: "Turn on 2FA" }).click();
  const dialog = page.getByTestId("two-factor-enable-dialog");
  await dialog.getByLabel("Password", { exact: true }).fill("Demo1234");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("img", { name: "QR code for the authenticator app" })).toBeVisible({
    timeout: 10000,
  });
  return dialog;
}

test.describe("Settings — 2FA", () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglish(page);
  });

  test.describe("positive", () => {
    test("turn on: password → QR + backup codes → code → On; stays On after a /auth/me screen", async ({
      page,
    }) => {
      await loginViaStorage(page);
      await gotoSettings(page);
      await expect(row(page).getByText("Off", { exact: true })).toBeVisible();

      const dialog = await startEnable(page);
      await expect(dialog.getByText(MOCK_BACKUP_CODES[0])).toBeVisible();
      // Submit waits for "I have saved my backup codes".
      await dialog.getByLabel("6-digit code from the app").fill(MOCK_TOTP_CODE);
      await expect(dialog.getByRole("button", { name: "Turn on 2FA" })).toBeDisabled();
      await dialog.getByRole("checkbox", { name: "I have saved my backup codes" }).click();
      await dialog.getByRole("button", { name: "Turn on 2FA" }).click();

      await expect(page.getByText("2FA is on.")).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(row(page).getByText("On", { exact: true })).toBeVisible();

      // /send (reads the store, no /auth/me refetch) and a screen that refreshes
      // /auth/me, then back: the copy does not go stale (users.yaml § twoFactorEnabled).
      await page.goto("/send");
      await expect(page.getByRole("main")).toBeVisible({ timeout: 15000 });
      await page.goto("/profile");
      await page.goto("/settings");
      await expect(row(page).getByText("On", { exact: true })).toBeVisible({ timeout: 15000 });
      const persisted = await page.evaluate(
        () => JSON.parse(localStorage.getItem("usdx-auth") ?? "{}").state?.user?.twoFactorEnabled,
      );
      expect(persisted).toBe(true);
    });

    test("turn off: the 24-hour hold is stated before confirming; password → Off", async ({ page }) => {
      await seedTwoFactor(page, true);
      await loginViaStorage(page, { twoFactorEnabled: true });
      await gotoSettings(page);

      await row(page).getByRole("button", { name: "Turn off" }).click();
      const dialog = page.getByTestId("two-factor-disable-dialog");
      await expect(dialog.getByTestId("two-factor-disable-warning")).toContainText("held for 24 hours");
      await dialog.getByLabel("Password", { exact: true }).fill("Demo1234");
      await dialog.getByRole("button", { name: "Turn off 2FA" }).click();

      await expect(page.getByText("2FA is off. Transfers and withdrawals are held for 24 hours.")).toBeVisible();
      await expect(row(page).getByText("Off", { exact: true })).toBeVisible();
    });

    test("new backup codes: 24-hour warning first, password → a new set, the old codes are gone", async ({ page }) => {
      await seedTwoFactor(page, true);
      await loginViaStorage(page, { twoFactorEnabled: true });
      await gotoSettings(page);

      await row(page).getByRole("button", { name: "New backup codes" }).click();
      const dialog = page.getByTestId("backup-codes-regenerate-dialog");
      // New codes replace the second factor (§6.1 no.6c): the hold is stated first.
      await expect(dialog.getByTestId("backup-codes-regenerate-warning")).toContainText("held for 24 hours");
      await dialog.getByLabel("Password", { exact: true }).fill("Demo1234");
      await dialog.getByRole("button", { name: "Create new codes" }).click();

      await expect(dialog.getByTestId("backup-codes-list")).toBeVisible({ timeout: 10000 });
      await expect(dialog.getByText(MOCK_BACKUP_CODES[0])).toHaveCount(0);
      await dialog.getByRole("checkbox", { name: "I have saved my backup codes" }).click();
      await dialog.getByRole("button", { name: "Done" }).click();
      await expect(dialog).toBeHidden();
    });
  });

  test.describe("negative", () => {
    test("a wrong code leaves 2FA off", async ({ page }) => {
      await loginViaStorage(page);
      await gotoSettings(page);
      const dialog = await startEnable(page);
      await dialog.getByRole("checkbox", { name: "I have saved my backup codes" }).click();
      await dialog.getByLabel("6-digit code from the app").fill("000000");
      await dialog.getByRole("button", { name: "Turn on 2FA" }).click();

      await expect(dialog.getByText("That code is wrong or has expired.", { exact: false })).toBeVisible({
        timeout: 10000,
      });
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(row(page).getByText("Off", { exact: true })).toBeVisible();
    });

    test("turning off with a wrong password changes nothing", async ({ page }) => {
      await seedTwoFactor(page, true);
      await loginViaStorage(page, { twoFactorEnabled: true });
      await gotoSettings(page);
      await row(page).getByRole("button", { name: "Turn off" }).click();
      const dialog = page.getByTestId("two-factor-disable-dialog");
      await dialog.getByLabel("Password", { exact: true }).fill("wrong-password");
      await dialog.getByRole("button", { name: "Turn off 2FA" }).click();

      await expect(dialog.getByText("Wrong password.")).toBeVisible({ timeout: 10000 });
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(row(page).getByText("On", { exact: true })).toBeVisible();
    });
  });

  test.describe("edge case", () => {
    test("reads in Indonesian and the enable dialog fits a 375px viewport", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await forceIndonesian(page);
      await loginViaStorage(page);
      await gotoSettings(page, "Pengaturan");

      await expect(row(page).getByText("Verifikasi dua langkah (2FA)")).toBeVisible();
      await row(page).getByRole("button", { name: "Aktifkan 2FA" }).click();
      const dialog = page.getByTestId("two-factor-enable-dialog");
      await dialog.getByLabel("Kata sandi", { exact: true }).fill("Demo1234");
      await dialog.getByRole("button", { name: "Lanjut" }).click();
      await expect(dialog.getByRole("img", { name: "Kode QR untuk aplikasi authenticator" })).toBeVisible({
        timeout: 10000,
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  });
});
