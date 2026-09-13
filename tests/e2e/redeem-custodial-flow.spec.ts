import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
  MOCK_PIN,
} from "../helpers/playwright-utils";

// Redeem from the custodial wallet (USDX-567, custodial-wallet.md §5.3): no
// wallet extension, no connect, no signature — the PIN is the approval, the
// system burns, and the tracker walks AWAITING_BURN → … → PAYOUT_COMPLETE.
// `seedWallet` (the external-wallet seam) is deliberately NOT armed here.
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await seedCustodialWallet(page, { status: "ACTIVE", balance: "500.00" });
  await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
});

async function fillBank(page: import("@playwright/test").Page) {
  await page.getByRole("combobox", { name: "Select bank" }).click();
  await page.getByText("BCA", { exact: true }).click();
  await page.getByPlaceholder("1234567890").fill("1234563210");
  await page.getByPlaceholder("As printed on the passbook").fill("SINGGIH BRILIAN TARA");
}

test.describe("Redeem Flow (custodial)", () => {
  test.describe("positive", () => {
    test("form → Ringkasan → PIN → tracker reaches payout with no wallet dialog at all", async ({
      page,
    }) => {
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      // Custodial source is the default: address + balance shown, no connect button.
      await expect(page.getByTestId("redeem-custodial-source")).toContainText("500 USDX", {
        timeout: 15000,
      });
      await expect(page.getByRole("button", { name: "Connect Wallet" })).toHaveCount(0);

      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await fillBank(page);

      // ONE click: nothing to connect first.
      await page.getByRole("button", { name: "Redeem", exact: true }).click();
      const summary = page.getByRole("dialog").filter({ hasText: "Transaction Summary" });
      await expect(summary).toBeVisible();
      await expect(summary.getByText("My custodial wallet")).toBeVisible();
      await expect(summary.getByText(/no wallet signature needed/)).toBeVisible();

      await summary.getByRole("button", { name: "Continue to Confirmation" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await expect(pin).toBeVisible();
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Confirm & Burn" }).click();

      // Tracker: the system is processing; no burn button, no connect.
      await expect(page.getByText(/Simulation mode/)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("nothing to do on your side")).toBeVisible();
      await expect(page.getByRole("button", { name: "Burn USDX" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Connect Wallet" })).toHaveCount(0);
      await expect(page.getByTestId("redeem-custodial-processing")).toBeVisible({ timeout: 10000 });

      await expect(page.getByText("Payout complete")).toBeVisible({ timeout: 25000 });
      await expect(page.getByText("Burn transaction")).toBeVisible();
    });

    test("Max fills the custodial balance", async ({ page }) => {
      await page.goto("/redeem");
      await expect(page.getByTestId("redeem-custodial-source")).toContainText("500 USDX", {
        timeout: 15000,
      });
      await page.getByRole("button", { name: "Max" }).first().click();
      await expect(page.getByPlaceholder("0", { exact: true })).toHaveValue("500");
    });
  });

  test.describe("negative", () => {
    test("wrong PIN stays in the PIN dialog; no order is created", async ({ page }) => {
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await fillBank(page);
      await page.getByRole("button", { name: "Redeem", exact: true }).click();
      await page.getByRole("button", { name: "Continue to Confirmation" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await pin.getByLabel("6-digit PIN").fill("000000");
      await pin.getByRole("button", { name: "Confirm & Burn" }).click();
      await expect(pin.getByText("Wrong PIN. Please try again.")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Simulation mode/)).toHaveCount(0);
    });
  });

  test.describe("edge case", () => {
    test("switching to the external wallet restores the contextual connect", async ({ page }) => {
      await page.goto("/redeem");
      await expect(page.getByTestId("redeem-source-custodial")).toBeVisible({ timeout: 15000 });
      await page.getByTestId("redeem-source-external").click();
      await expect(page.getByRole("button", { name: "Connect Wallet" })).toHaveCount(1);
      await expect(page.getByTestId("redeem-custodial-source")).toHaveCount(0);
    });
  });
});
