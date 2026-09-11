import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  seedCustodialWallet,
  MOCK_CUSTODIAL_ADDRESS,
} from "../helpers/playwright-utils";

// Sidebar custodial balance card (USDX-566 § Beranda). Sits beside the
// connected-wallet card, never instead of it; absent for non-custodial users;
// prints digits only for a number the backend actually returned.

const ACTIVE = { address: MOCK_CUSTODIAL_ADDRESS, status: "ACTIVE" as const };
const card = '[data-slot="custodial-balance"]';

test.describe("Sidebar — custodial balance card", () => {
  test.describe("positive", () => {
    test("a custodial user sees both cards: connect-wallet as before, plus the custodial balance", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "125.50" });
      await loginViaStorage(page, { custodialWallet: ACTIVE });
      await page.goto("/mint");

      const aside = page.getByRole("complementary");
      await expect(aside.locator(card)).toBeVisible({ timeout: 15000 });
      await expect(aside.locator(card).getByText("My USDX wallet")).toBeVisible();
      await expect(aside.locator(card).getByText("125.5 USDX")).toBeVisible();
      // The connect-wallet card is untouched — no number, the same prompt.
      await expect(aside.getByText("Total balance")).toBeVisible();
      await expect(aside.getByText("Connect a wallet to see your balance")).toBeVisible();

      await aside.locator(card).getByRole("link", { name: "Receive" }).click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByText("Receiving address")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("a non-custodial user's sidebar is exactly as before — no card", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);
      await page.goto("/mint");

      const aside = page.getByRole("complementary");
      await expect(aside.getByText("Total balance")).toBeVisible({ timeout: 15000 });
      await expect(aside.locator(card)).toHaveCount(0);
      await expect(aside.getByText("My USDX wallet")).toHaveCount(0);
    });

    test("an unreadable balance is — with a reason, never 0", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: null });
      await loginViaStorage(page, { custodialWallet: ACTIVE });
      await page.goto("/mint");

      const custodial = page.getByRole("complementary").locator(card);
      await expect(custodial.getByText("— USDX")).toBeVisible({ timeout: 15000 });
      await expect(custodial.getByText("Balance unavailable")).toBeVisible();
      await expect(custodial.getByText("0 USDX")).toHaveCount(0);
    });
  });

  test.describe("edge case", () => {
    test("PROVISIONING shows a status pill and no number — there is no address to read yet", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "PROVISIONING", stuck: true });
      await loginViaStorage(page, { custodialWallet: { address: null, status: "PROVISIONING" } });
      await page.goto("/mint");

      const custodial = page.getByRole("complementary").locator(card);
      await expect(custodial).toHaveAttribute("data-status", "PROVISIONING", { timeout: 15000 });
      await expect(custodial.getByText("Being set up")).toBeVisible();
      await expect(custodial.getByText("— USDX")).toBeVisible();
      await expect(custodial.getByText("0 USDX")).toHaveCount(0);
    });

    test("SUSPENDED shows the pill AND the real balance — the money is still there", async ({
      page,
    }) => {
      // wallet.yaml: the balance is read live from chain whatever the status;
      // only PROVISIONING (no address) and an unreachable RPC make it null.
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "SUSPENDED", balance: "3.00" });
      await loginViaStorage(page, { custodialWallet: { ...ACTIVE, status: "SUSPENDED" } });
      await page.goto("/mint");

      const custodial = page.getByRole("complementary").locator(card);
      await expect(custodial).toHaveAttribute("data-status", "SUSPENDED", { timeout: 15000 });
      await expect(custodial.getByText("Suspended")).toBeVisible();
      await expect(custodial.getByText("3 USDX")).toBeVisible();
    });

    test("the card is translated in the Indonesian locale", async ({ page }) => {
      await forceIndonesian(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "7.25" });
      await loginViaStorage(page, { custodialWallet: ACTIVE });
      await page.goto("/mint");

      const custodial = page.getByRole("complementary").locator(card);
      await expect(custodial.getByText("Wallet USDX saya")).toBeVisible({ timeout: 15000 });
      await expect(custodial.getByRole("link", { name: "Terima" })).toBeVisible();
    });
  });
});
