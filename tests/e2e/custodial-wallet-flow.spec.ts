import { test, expect, type Page } from "@playwright/test";
import {
  clearAuth,
  forceEnglish,
  loginViaStorage,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
  seedCustodialWallet,
} from "../helpers/playwright-utils";

// The custodial wallet end to end against the mock (USDX-566), as it stands after
// custodial-wallet.md §1, amandemen 14 Sep 2026:
//   1. a new user registers → verifies → lands on /mint (no wallet step), and
//      Settings carries the offer with a "Coming Soon" pill
//   2. a user who already has a wallet receives USDX → the balance shows the real number
//   3. nowhere in the app can a user without a wallet create one
// "Receiving USDX" is played by moving the mock's stored balance (the number
// GET /api/v2/wallet reads live from chain in production) and refreshing.

async function receiveUsdx(page: Page, balance: string) {
  await page.evaluate((b) => {
    const raw = localStorage.getItem("usdx-mock-custodial");
    if (!raw) throw new Error("no custodial wallet in the mock");
    localStorage.setItem("usdx-mock-custodial", JSON.stringify({ ...JSON.parse(raw), balance: b }));
  }, balance);
}

test.describe("Custodial wallet flow", () => {
  test.describe("positive", () => {
    test("register → verify → lands on /mint → Settings shows the offer as Coming Soon", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await page.goto("/login");
      await clearAuth(page);

      // Register (no session yet — email must be verified first).
      await page.goto("/register");
      await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible({
        timeout: 15000,
      });
      await page.getByPlaceholder("Enter your email").fill(`custodial-${Date.now()}@test.com`);
      await page.getByPlaceholder("08xx or +62xx").fill("081234567892");
      await page.getByPlaceholder("Create a password").fill("E2eTest12");
      await page.getByPlaceholder("Type the password again").fill("E2eTest12");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForURL(/\/register\/check-email/, { timeout: 30000 });

      // The activation link lands on the dashboard, like login — not on the
      // wallet step.
      await page.goto("/verify-email?token=valid-token");
      await page.waitForURL(/\/mint$/, { timeout: 30000 });
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-slot="custodial-balance"]')).toHaveCount(0);

      await page.goto("/settings");
      const card = page.locator('[data-slot="settings-wallet"]');
      await expect(card.getByText("No wallet yet? We'll make you one.")).toBeVisible({
        timeout: 15000,
      });
      await expect(card.locator('[data-slot="wallet-offer-soon"]')).toHaveText("Coming Soon");
    });

    test("a user who already has a wallet receives USDX → the balance shows", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "0.00" });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15000 });

      const balance = page.locator('[data-slot="wallet-balance"]');
      await expect(balance).toHaveText("0 USDX", { timeout: 15000 });
      await expect(page.getByText("Receiving address")).toBeVisible();

      await receiveUsdx(page, "42.00");
      await page.getByRole("button", { name: "Refresh" }).click();
      await expect(balance).toHaveText("42 USDX", { timeout: 15000 });

      // Survives a full reload: the profile copy + the mock agree on ACTIVE.
      await page.goto("/mint");
      await expect(page.locator('[data-slot="custodial-balance"]').getByText("42 USDX")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("negative", () => {
    test("a user without a wallet finds no create button in Settings or on the onboarding step", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);

      await page.goto("/settings");
      await expect(page.getByText("No wallet yet? We'll make you one.")).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("button", { name: "Create my wallet" })).toHaveCount(0);

      await page.goto("/onboarding/wallet");
      await expect(page.getByRole("heading", { name: "No wallet yet? We'll make you one." })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("button", { name: "Create my wallet" })).toHaveCount(0);
    });
  });

  test.describe("edge case", () => {
    test("leaving the onboarding step with Not now leaves no wallet behind", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);
      await page.goto("/onboarding/wallet");
      await expect(page.locator('[data-slot="wallet-offer-soon"]')).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "Not now" }).click();
      await expect(page).toHaveURL(/\/mint$/);
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
      // The mock writes this key on POST /api/v2/wallet; it must still be absent.
      expect(await page.evaluate(() => localStorage.getItem("usdx-mock-custodial"))).toBeNull();
      await expect(page.locator('[data-slot="custodial-balance"]')).toHaveCount(0);
    });
  });
});
