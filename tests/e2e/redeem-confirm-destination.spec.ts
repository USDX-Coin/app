import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedWallet,
  seedInquiryName,
} from "../helpers/playwright-utils";

// Konfirmasi tujuan sebelum burn (USDX-661, bni-integration.md § 17.12). Setelah
// order terbit dan SEBELUM burn bisa dijalankan, layar menyebutkan tujuan dari
// response order — bank · nomor rekening · nama pemilik menurut bank — dan burn
// tetap mati sampai nasabah menyetujuinya secara eksplisit. Berlaku di jalur create
// maupun jalur melanjutkan order dari /history.

const TYPED_NAME = "SINGGIH BRILIAN TARA";

async function fillForm(page: Page, amount = "100") {
  await page.getByPlaceholder("0", { exact: true }).fill(amount);
  await page.getByRole("combobox", { name: "Select bank" }).click();
  await page.getByText("BCA", { exact: true }).click();
  await page.getByPlaceholder("1234567890").fill("1234563210");
  await page.getByPlaceholder("As printed on the passbook").fill(TYPED_NAME);
}

// The CTA is always "Redeem": first click connects (seam), second opens the modal.
async function openRingkasan(page: Page) {
  const redeem = page.getByRole("button", { name: "Redeem", exact: true });
  await redeem.click();
  await redeem.click();
  await expect(page.getByText("Transaction Summary")).toBeVisible();
}

async function createOrder(page: Page) {
  await page.goto("/redeem");
  await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
  await fillForm(page);
  await openRingkasan(page);
  await page.getByRole("button", { name: "Confirm & Burn" }).click();
}

test.describe("Redeem — confirm destination before burn", () => {
  test.describe("negative", () => {
    test("no burn until the destination is agreed to", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await loginViaStorage(page);
      await createOrder(page);

      // Order terbit → tracker menyebutkan tujuan lengkap dari response order.
      const block = page.getByTestId("redeem-confirm-destination");
      await expect(block).toBeVisible({ timeout: 15000 });
      await expect(block.getByText("BCA", { exact: true })).toBeVisible();
      await expect(block.getByText("1234563210")).toBeVisible();
      await expect(block.getByText(/gone permanently/)).toBeVisible();

      // Persetujuan belum diberikan → tombol burn tidak bisa ditekan.
      const burn = page.getByRole("button", { name: "Burn USDX" });
      await expect(burn).toBeDisabled();
      // Dan tidak ada burn yang berjalan sendiri di belakangnya.
      await expect(page.getByText(/Processing burn/)).toHaveCount(0);

      // Disetujui → burn aktif, dan alur burn berikutnya tidak berubah.
      await block.getByRole("checkbox").click();
      await expect(burn).toBeEnabled();
      await burn.click();
      await expect(page.getByText(/Processing burn/)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Payout complete")).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe("positive", () => {
    test("shows the bank's holder name, not the one the customer typed", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page);
      // Inquiry menjawab nama lain untuk nomor yang sama — kelas kesalahan yang
      // dijaga tiket ini: nomor valid, tapi milik orang lain.
      await seedInquiryName(page, "SITI AMINAH");
      await loginViaStorage(page);
      await createOrder(page);

      const block = page.getByTestId("redeem-confirm-destination");
      await expect(block).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("redeem-destination-name")).toHaveText("SITI AMINAH");
      // Nama yang diketik nasabah tidak muncul di layar pra-burn.
      await expect(block.getByText(TYPED_NAME)).toHaveCount(0);
      // Dan kalimat persetujuannya menyebut nama itu, bukan nama ketikan.
      await expect(block.getByText(/the IDR goes to SITI AMINAH/)).toBeVisible();
    });

    test("resume from history asks for the same agreement", async ({ page }) => {
      await forceEnglish(page);
      await seedWallet(page); // default mock address = the seeded order's userAddress
      await loginViaStorage(page);

      await page.goto("/history");
      await expect(page.getByText("Transaction History")).toBeVisible({ timeout: 15000 });
      await page.getByRole("tab", { name: "All Transaction" }).click();
      await page.getByRole("tab", { name: "Redeem", exact: true }).click();
      await page.getByRole("button", { name: "Continue" }).first().click();
      await expect(page.getByRole("heading", { name: "Redeem Status" })).toBeVisible({
        timeout: 15000,
      });
      await page.getByRole("button", { name: "Connect Wallet" }).click();

      // Di sinilah nasabah paling mungkin sudah lupa rekening apa yang ia pilih.
      const block = page.getByTestId("redeem-confirm-destination");
      await expect(block).toBeVisible();
      await expect(page.getByTestId("redeem-destination-name")).toHaveText("Demo User");

      const burn = page.getByRole("button", { name: "Burn USDX" });
      await expect(burn).toBeDisabled();
      await block.getByRole("checkbox").click();
      await expect(burn).toBeEnabled();
      await burn.click();
      await expect(page.getByText(/Processing burn/)).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("edge cases", () => {
    test('no holder name from the bank → "—" and the agreement is still asked', async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedWallet(page);
      await seedInquiryName(page, ""); // inquiry answered without a name
      await loginViaStorage(page);
      await createOrder(page);

      const block = page.getByTestId("redeem-confirm-destination");
      await expect(block).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("redeem-destination-name")).toHaveText("—");
      await expect(block.getByText(/did not return a holder name/)).toBeVisible();

      // Tidak dilewati diam-diam: burn tetap mati sampai dicentang.
      const burn = page.getByRole("button", { name: "Burn USDX" });
      await expect(burn).toBeDisabled();
      await block.getByRole("checkbox").click();
      await expect(burn).toBeEnabled();
    });
  });
});
