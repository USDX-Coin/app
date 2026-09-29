import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedTwoFactor,
  expireTwoFactorChallenge,
  MOCK_BACKUP_CODES,
  MOCK_RECOVERY_OTP,
  MOCK_TOTP_CODE,
} from "../helpers/playwright-utils";

// Login on a 2FA account in the web (auth.yaml § loginV2 → two-factor.yaml §
// verifyLogin + § recoveryEmail, USDX-714 — closes the 22 Sep GAP), against the mock
// backend: email + password → the code screen → in. A login that follows "Log in
// again" (forgot PIN, USDX-696) still lands on its screen after the code. "Can't
// access your authenticator?" → email OTP turns 2FA off (24-hour hold stated first)
// and logs in.

const CODE_HEADING = "Enter your authenticator code";

async function passwordStep(page: Page) {
  await expect(page).toHaveURL(/\/login/);
  await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("Enter your password").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("heading", { name: CODE_HEADING })).toBeVisible({ timeout: 15000 });
}

async function enterCode(page: Page, code: string) {
  await page.getByLabel("Authenticator code or backup code").fill(code);
  await page.getByRole("button", { name: "Verify & log in" }).click();
}

async function logout(page: Page) {
  await page.evaluate(() => localStorage.removeItem("usdx-auth"));
  await page.goto("/login");
}

test.describe("2FA login flow", () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglish(page);
    await seedTwoFactor(page, true);
  });

  test.describe("positive", () => {
    test("email + password → code screen → authenticator code → /mint", async ({ page }) => {
      await page.goto("/login");
      await passwordStep(page);
      await enterCode(page, MOCK_TOTP_CODE);
      await expect(page).toHaveURL(/\/mint$/, { timeout: 15000 });
    });

    test("a backup code logs in once; the same code is refused the next time", async ({ page }) => {
      await page.goto("/login");
      await passwordStep(page);
      await enterCode(page, MOCK_BACKUP_CODES[4]);
      await expect(page).toHaveURL(/\/mint$/, { timeout: 15000 });

      await logout(page);
      await passwordStep(page);
      await enterCode(page, MOCK_BACKUP_CODES[4]);
      await expect(page.getByText("That code is wrong or has expired.", { exact: false })).toBeVisible({
        timeout: 10000,
      });
      await expect(page).toHaveURL(/\/login/);
    });

    test("forgot PIN → log in again on a 2FA account → after the code, back on Settings with Create a new PIN", async ({
      page,
    }) => {
      await loginViaStorage(page, { twoFactorEnabled: true });
      await page.goto("/settings");
      await page.locator('[data-slot="settings-pin"]').getByRole("button", { name: "Change PIN" }).click();
      await page.getByTestId("pin-change-dialog").getByRole("button", { name: "Forgot PIN?" }).click();
      await page.getByTestId("forgot-pin-dialog").getByRole("button", { name: "Log in again" }).click();

      await passwordStep(page);
      await enterCode(page, MOCK_TOTP_CODE);

      await expect(page).toHaveURL(/\/settings$/, { timeout: 15000 });
      await expect(
        page.getByTestId("pin-setup-dialog").getByRole("heading", { name: "Create a new PIN" }),
      ).toBeVisible({ timeout: 15000 });
    });

    test("can't access the authenticator → 24-hour warning → email OTP → 2FA off and logged in", async ({
      page,
    }) => {
      await page.goto("/login");
      await passwordStep(page);
      await page.getByRole("button", { name: "Can't access your authenticator?" }).click();

      const warning = page.getByTestId("two-factor-recovery-warning");
      await expect(warning).toContainText("held for 24 hours");
      await page.getByRole("button", { name: "Send code to email" }).click();
      await page.getByLabel("Code from the email").fill(MOCK_RECOVERY_OTP);
      await expect(warning).toBeVisible();
      await page.getByRole("button", { name: "Turn off 2FA & log in" }).click();

      await expect(page).toHaveURL(/\/mint$/, { timeout: 15000 });
      await page.goto("/settings");
      await expect(page.locator('[data-slot="settings-2fa"]').getByText("Off", { exact: true })).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("negative", () => {
    test("a wrong code keeps the user on the code screen", async ({ page }) => {
      await page.goto("/login");
      await passwordStep(page);
      await enterCode(page, "000000");
      await expect(page.getByText("That code is wrong or has expired.", { exact: false })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByRole("heading", { name: CODE_HEADING })).toBeVisible();
    });
  });

  test.describe("edge case", () => {
    test("the verification ran out → back to the password form with a sentence", async ({ page }) => {
      await page.goto("/login");
      await passwordStep(page);
      await expireTwoFactorChallenge(page);
      await enterCode(page, MOCK_TOTP_CODE);

      await expect(page.getByTestId("two-factor-expired")).toBeVisible({ timeout: 10000 });
      await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
    });
  });
});
