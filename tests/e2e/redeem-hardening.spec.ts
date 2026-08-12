import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedWallet,
  seedWalletState,
  seedBurnReject,
} from "../helpers/playwright-utils";

// Redeem hardening (USDX-259): connect-wallet precondition gate (network / USDX
// balance / gas), sending userAddress at create, optimistic burn-tx report,
// guard double-burn, and resume from /history bound to the order's wallet.
// All exercised offline via the wallet + mock seams.

async function fillForm(page: Page, amount = "100") {
  await page.getByPlaceholder("0", { exact: true }).fill(amount);
  await page.getByRole("button", { name: "Select bank" }).click();
  await page.getByText("BCA", { exact: true }).click();
  await page.getByPlaceholder("Enter account number").fill("1234563210");
  await page.getByPlaceholder("Enter holder name").fill("SINGGIH BRILIAN TARA");
}

// Open the Ringkasan: the CTA is always "Redeem" — first click connects (seam),
// second click (now connected) opens the modal.
async function openRingkasan(page: Page) {
  const redeem = page.getByRole("button", { name: "Redeem", exact: true });
  await redeem.click();
  await redeem.click();
  await expect(page.getByText("Transaction Summary")).toBeVisible();
}

test.describe("Redeem hardening — precondition gate", () => {
  test.describe("negative", () => {
    test("wrong network → switch prompt + burn disabled", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await seedWalletState(page, { chainId: 1 }); // Ethereum, not Polygon
      await loginViaStorage(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      await fillForm(page);
      await openRingkasan(page);

      await expect(page.getByRole("button", { name: "Switch to Polygon" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm & Burn" })).toBeDisabled();
    });

    test("insufficient USDX balance → message + burn disabled", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await seedWalletState(page, { balanceUsdx: 10 }); // < 100 USDX redeemed
      await loginViaStorage(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      await fillForm(page, "100");
      await openRingkasan(page);

      await expect(page.getByText("Insufficient USDX balance.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm & Burn" })).toBeDisabled();
    });
  });

  test.describe("positive", () => {
    test("low gas is a warning, not a block — burn still allowed", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await seedWalletState(page, { gasPol: 0 }); // no POL for gas
      await loginViaStorage(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      await fillForm(page);
      await openRingkasan(page);

      await expect(page.getByText(/enough POL/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm & Burn" })).toBeEnabled();
    });
  });
});

test.describe("Redeem hardening — burn-tx report + guard", () => {
  test.describe("positive", () => {
    test("confirm → optimistic 'processing burn' → payout complete", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await loginViaStorage(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      await fillForm(page);
      await openRingkasan(page);
      await page.getByRole("button", { name: "Confirm & Burn" }).click();

      // Optimistic burn-tx report stamps the order → "processing burn" before the
      // scanner confirms (status still AWAITING_BURN).
      await expect(page.getByText(/Processing burn/)).toBeVisible({ timeout: 15000 });
      // Mock lifecycle then advances to payout complete with a burn tx link.
      await expect(page.getByText("Payout complete")).toBeVisible({ timeout: 20000 });
      await expect(page.getByText("Burn transaction")).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("rejected burn → error + retry, then succeeds", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await seedBurnReject(page); // one-shot: first broadcast throws, retry goes through
      await loginViaStorage(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      await fillForm(page);
      await openRingkasan(page);
      await page.getByRole("button", { name: "Confirm & Burn" }).click();

      // The burn was rejected in the wallet — the order stays AWAITING_BURN and a
      // retry is offered (guard double-burn: no second tx auto-fired).
      await expect(page.getByText(/rejected in your wallet/)).toBeVisible({ timeout: 15000 });
      const retry = page.getByRole("button", { name: "Retry burn" });
      await expect(retry).toBeVisible();
      await retry.click();

      await expect(page.getByText("Payout complete")).toBeVisible({ timeout: 20000 });
    });
  });
});

test.describe("Redeem hardening — resume from history", () => {
  // Open the seeded AWAITING_BURN order from /history and reconnect a wallet.
  async function resumeSeededOrder(page: Page) {
    await page.goto("/history");
    await expect(page.getByText("Transaction History")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "All Transaction" }).click();
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).first().click();
    // Lands on the tracker for the resumed order; reconnect the wallet in-flow.
    await expect(page.getByRole("heading", { name: "Redeem Status" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Connect Wallet" }).click();
  }

  test.describe("negative", () => {
    test("wallet ≠ order.userAddress → bound-to-another-wallet warning", async ({ page }) => {
      await forceEnglish(page);
      // Connect a wallet different from the seeded order's bound userAddress.
      await seedWallet(page, "0xAAAA000000000000000000000000000000000AAA");
      await loginViaStorage(page);
      await resumeSeededOrder(page);

      await expect(page.getByText(/bound to another wallet/)).toBeVisible();
      // No burn is possible from the wrong wallet.
      await expect(page.getByRole("button", { name: "Burn USDX" })).toHaveCount(0);
    });
  });

  test.describe("positive", () => {
    test("matching wallet → burn enabled, runs to payout complete", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page); // default mock address = the seeded order's userAddress
      await loginViaStorage(page);
      await resumeSeededOrder(page);

      const burn = page.getByRole("button", { name: "Burn USDX" });
      await expect(burn).toBeEnabled();
      await burn.click();

      await expect(page.getByText(/Processing burn/)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Payout complete")).toBeVisible({ timeout: 20000 });
    });
  });
});
