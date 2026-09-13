import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedWallet,
  seedPayoutFailed,
} from "../helpers/playwright-utils";

// Status PAYOUT_FAILED (USDX-664, common.yaml § RedeemStatus rev 2026-09-12).
// Backend mengirimkannya sejak backend#320; klien WAJIB merendernya. Keadaan
// tersendiri: bukan langkah keempat yang gagal, bukan pemetaan balik ke
// PROCESSING_PAYOUT, dan bukan galat merah dengan tombol "coba lagi" — nasabah
// tidak bisa memperbaikinya sendiri.

async function burnWithFailedPayout(page: Page) {
  await page.goto("/redeem");
  await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("0", { exact: true }).fill("100");
  await page.getByRole("combobox", { name: "Select bank" }).click();
  await page.getByText("BCA", { exact: true }).click();
  await page.getByPlaceholder("1234567890").fill("1234563210");
  await page.getByPlaceholder("As printed on the passbook").fill("SINGGIH BRILIAN TARA");

  const redeem = page.getByRole("button", { name: "Redeem", exact: true });
  await redeem.click();
  await redeem.click();
  await page.getByRole("button", { name: "Continue to Confirmation" }).click();

  // Konfirmasi tujuan (USDX-661) lalu burn — lifecycle mock lanjut sendiri.
  const block = page.getByTestId("redeem-confirm-destination");
  await expect(block).toBeVisible({ timeout: 15000 });
  await block.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Burn USDX" }).click();
}

test.describe("Redeem — PAYOUT_FAILED", () => {
  test.describe("positive", () => {
    test("tracker states the payout problem instead of a hanging stepper", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await seedPayoutFailed(page); // provider refuses the payout definitively
      await loginViaStorage(page);
      await burnWithFailedPayout(page);

      const state = page.getByTestId("redeem-payout-failed");
      await expect(state).toBeVisible({ timeout: 25000 });
      await expect(state).toContainText("Payout needs attention");
      // Jujur tapi menenangkan: USDX sudah terbakar, tim menanganinya, tidak ada
      // yang perlu nasabah lakukan.
      await expect(state).toContainText(/already burned/);
      await expect(state).toContainText(/team is handling it/);
      await expect(state).toContainText(/nothing you need to do/);
      // Tapi TIDAK menjanjikan pembayarannya jadi: ops bisa me-resolve order ini
      // CLOSED (= tidak akan dibayar) dan FE tidak punya field resolusi untuk
      // membedakannya dari RESEND/SETTLED_MANUAL.
      await expect(state).not.toContainText(/settling the payout/);
      await expect(state).not.toContainText(/will be paid/);

      // Stepper diganti seluruhnya: tidak ada langkah yang tampak aktif-menggantung.
      await expect(page.getByText("Awaiting burn")).toHaveCount(0);
      await expect(page.getByText("Sending IDR")).toHaveCount(0);
      await expect(page.getByText("Payout complete")).toHaveCount(0);
    });

    test("history shows a human-readable badge, not the raw code", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/history");
      await expect(page.getByText("Transaction History")).toBeVisible({ timeout: 15000 });
      await page.getByRole("tab", { name: "All Transaction" }).click();
      await page.getByRole("tab", { name: "Redeem", exact: true }).click();

      await expect(page.getByText("Payout needs attention").first()).toBeVisible();
      await expect(page.getByText("PAYOUT_FAILED")).toHaveCount(0);
    });
  });

  test.describe("negative", () => {
    test("offers no burn and no retry — the customer cannot fix this", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await seedPayoutFailed(page);
      await loginViaStorage(page);
      await burnWithFailedPayout(page);

      await expect(page.getByTestId("redeem-payout-failed")).toBeVisible({ timeout: 25000 });
      await expect(page.getByRole("button", { name: "Burn USDX" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Retry burn" })).toHaveCount(0);
      await expect(page.getByTestId("redeem-confirm-destination")).toHaveCount(0);
      // Hitung mundur jendela burn hanya milik AWAITING_BURN.
      await expect(page.getByText(/Burn window expires in/)).toHaveCount(0);
    });
  });
});
