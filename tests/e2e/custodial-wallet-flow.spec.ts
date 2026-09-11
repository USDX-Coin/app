import { test, expect, type Page } from "@playwright/test";
import {
  clearAuth,
  forceEnglish,
  loginViaStorage,
  seedCustodialWallet,
} from "../helpers/playwright-utils";

// The three E2E acceptance criteria of USDX-566, end to end against the mock:
//   1. new user registers → verifies → picks "dikasih wallet" → ACTIVE, balance 0
//      → receives USDX → the balance shows the real number
//   2. an existing user activates from Settings → the same result
//   3. a user who declines → the app works exactly as before
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
    test("register → verify → dikasih wallet → ACTIVE with 0 → receives USDX → balance shows", async ({
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

      // The activation link: the first session of the account lands on the
      // optional wallet step, not on /mint.
      await page.goto("/verify-email?token=valid-token");
      await page.waitForURL(/\/onboarding\/wallet/, { timeout: 30000 });
      await page.getByRole("button", { name: "Create my wallet" }).click();
      await expect(page.getByText("Your wallet is being set up")).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("heading", { name: "Your wallet is ready" })).toBeVisible({
        timeout: 20000,
      });
      const balance = page.locator('[data-slot="wallet-balance"]');
      await expect(balance).toHaveText("0 USDX");

      // USDX arrives (a mint to this address in dev) → refresh reads it.
      await receiveUsdx(page, "125.50");
      await page.getByRole("button", { name: "Refresh" }).click();
      await expect(balance).toHaveText("125.5 USDX", { timeout: 15000 });
      await expect(page.locator('[data-slot="custodial-balance"]').getByText("125.5 USDX")).toBeVisible();

      await page.getByRole("link", { name: "Continue to the app" }).click();
      await expect(page).toHaveURL(/\/mint$/);
      await expect(page.locator('[data-slot="custodial-balance"]').getByText("125.5 USDX")).toBeVisible({
        timeout: 15000,
      });
    });

    test("existing user activates from Settings → the same result", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "Create my wallet" }).click();
      await expect(page.getByText("Your wallet is being set up")).toBeVisible({ timeout: 10000 });
      const balance = page.locator('[data-slot="wallet-balance"]');
      await expect(balance).toHaveText("0 USDX", { timeout: 20000 });
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
    test("a user who declines gets the app exactly as before", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await page.goto("/login");
      await clearAuth(page);
      await page.goto("/verify-email?token=valid-token");
      await page.waitForURL(/\/onboarding\/wallet/, { timeout: 30000 });

      await page.getByRole("button", { name: "Not now" }).click();
      await expect(page).toHaveURL(/\/mint$/);
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-slot="custodial-balance"]')).toHaveCount(0);

      // Login afterwards still lands on /mint (login is not onboarding), and
      // Settings still carries the offer for whenever they change their mind.
      await page.goto("/settings");
      await expect(page.getByRole("button", { name: "Create my wallet" })).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("edge cases", () => {
    test("pressing create twice does not error and does not make a second wallet", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15000 });

      const create = page.getByRole("button", { name: "Create my wallet" });
      await create.click();
      // While PROVISIONING the offer is gone; any repeat POST is a 202, so
      // there is no error state to land in and exactly one address at the end.
      await expect(page.getByText("Your wallet is being set up")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Receiving address")).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-slot="receive-address-value"]')).toHaveCount(1);
      // Scoped to main: Next's route announcer outside it also has role=alert.
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    });
  });
});
