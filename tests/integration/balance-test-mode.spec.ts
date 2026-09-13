import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedWallet,
  seedWalletState,
  seedMintMode,
} from "../helpers/playwright-utils";

// Balance panel + test-mint strip (USDX-640). The token address comes from
// GET /api/v2/config; while the backend reports the TEST bundle the panel gains
// a SECOND row for the test token, and the main balance keeps showing real USDX.
// The failure this guards is the demo-day one: flipping the address globally and
// telling a real holder their balance is 0.

// Wallets are connected contextually — the app has no global connect button
// (W2 principle). The redeem CTA is the only door, and it only opens once the
// form is valid, so fill it first.
async function connectWallet(page: Page) {
  await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("0", { exact: true }).fill("100");
  await page.getByRole("combobox", { name: "Select bank" }).click();
  await page.getByText("BCA", { exact: true }).click();
  await page.getByPlaceholder("1234567890").fill("1234563210");
  await page.getByPlaceholder("As printed on the passbook").fill("SINGGIH BRILIAN TARA");
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
}

test.describe("Balance panel — mint mode", () => {
  test.describe("positive", () => {
    test("PROD mode: the balance card looks exactly as it does today, no strip", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedMintMode(page, "PROD");
      await seedWallet(page);
      await seedWalletState(page, { balanceUsdx: 1200 });
      await loginViaStorage(page);
      await page.goto("/redeem");
      await connectWallet(page);

      await expect(page.getByRole("complementary").getByText("1,200 USDX")).toBeVisible();
      await expect(page.getByText("Test mode")).toHaveCount(0);
      await expect(page.locator('[data-slot="test-mint-balance"]')).toHaveCount(0);
    });

    test("TEST mode: main balance stays real USDX and the test token gets its own strip", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedMintMode(page, "TEST");
      await seedWallet(page);
      await seedWalletState(page, { balanceUsdx: 1200, testBalanceUsdx: 25 });
      await loginViaStorage(page);
      await page.goto("/redeem");
      await connectWallet(page);

      // The real holding is untouched — this is the whole point of the ticket.
      await expect(page.getByRole("complementary").getByText("1,200 USDX")).toBeVisible();

      const strip = page.locator('[data-slot="test-mint-balance"]');
      await expect(strip).toBeVisible();
      await expect(strip.getByText("Test mode")).toBeVisible();
      await expect(strip.getByText("25", { exact: true })).toBeVisible();
      await expect(strip.getByText("not your USDX")).toBeVisible();
    });

    test("the strip's number moves once test tokens land in the wallet", async ({ page }) => {
      // AC of the recorded demo: the mint uji has to be visibly received. Start
      // from a wallet nothing has been minted into, then let the tokens arrive.
      await forceEnglish(page);
      await seedMintMode(page, "TEST");
      await seedWallet(page);
      await seedWalletState(page, { balanceUsdx: 1200, testBalanceUsdx: 0 });
      await loginViaStorage(page);
      await page.goto("/redeem");
      await connectWallet(page);

      const strip = page.locator('[data-slot="test-mint-balance"]');
      await expect(strip.getByText("0", { exact: true })).toBeVisible();

      // The mint lands: the wallet now holds 25 test tokens. Re-seeding rather
      // than writing localStorage directly — the seam is armed by an init script
      // that re-runs on every navigation and would overwrite a direct write.
      await seedWalletState(page, { testBalanceUsdx: 25 });
      await page.reload();
      await connectWallet(page);

      await expect(strip.getByText("25", { exact: true })).toBeVisible();
      // …and the real USDX holding never moved.
      await expect(page.getByRole("complementary").getByText("1,200 USDX")).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("TEST mode with no wallet connected → strip shows no number", async ({ page }) => {
      await forceEnglish(page);
      await seedMintMode(page, "TEST");
      await seedWallet(page);
      await loginViaStorage(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      const strip = page.locator('[data-slot="test-mint-balance"]');
      await expect(strip).toBeVisible();
      await expect(strip.getByText("Connect a wallet to see your balance")).toBeVisible();
      // The card above says the same thing — neither prints a 0.
      await expect(page.getByRole("complementary").getByText("— USDX")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("a test wallet that has not been minted into yet reads 0, not unknown", async ({
      page,
    }) => {
      // Where the recorded demo starts: strip present, honest zero, then the
      // mint lands and the number moves.
      await forceEnglish(page);
      await seedMintMode(page, "TEST");
      await seedWallet(page);
      await seedWalletState(page, { balanceUsdx: 1200, testBalanceUsdx: 0 });
      await loginViaStorage(page);
      await page.goto("/redeem");
      await connectWallet(page);

      const strip = page.locator('[data-slot="test-mint-balance"]');
      await expect(strip.getByText("0", { exact: true })).toBeVisible();
      await expect(strip.getByText("not your USDX")).toBeVisible();
    });
  });
});
