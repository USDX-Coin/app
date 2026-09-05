import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  pickOccupation,
  seedKycStatus,
  TEST_PNG,
} from "../helpers/playwright-utils";

// Blok identitas /kyc setelah USDX-586: lima field wajib POJK 8/2023 Pasal 25 ayat
// (1) huruf a yang sebelumnya tidak punya input sama sekali (kewarganegaraan, jenis
// kelamin, status perkawinan, nama gadis ibu kandung, plus alias yang opsional), dan
// jenis identitas yang kini bisa dipilih (KTP / paspor, Pasal 26 ayat (2)).
//
// Sebelum tiket ini setiap submit KYC dari app dijawab 422 VALIDATION_ERROR karena
// backend sudah mewajibkan field-field itu — jadi yang diuji di sini adalah bahwa
// form benar-benar mengirimnya, bukan sekadar menampilkannya.

async function gotoKyc(page: Page, locale: "en" | "id" = "en") {
  if (locale === "en") await forceEnglish(page);
  else await forceIndonesian(page);
  await seedKycStatus(page, "UNVERIFIED");
  await loginViaStorage(page);
  await page.goto("/kyc");
  await expect(
    page.getByRole("heading", {
      name: locale === "en" ? "Identity Verification" : "Verifikasi Identitas",
    }),
  ).toBeVisible({ timeout: 15000 });
}

async function fillEverything(page: Page) {
  await page.getByLabel("First Name").fill("Budi");
  await page.getByLabel("Last Name").fill("Santoso");
  await page.getByLabel("Date of Birth").fill("1995-03-15");
  await page.getByLabel("Birth Place").fill("Jakarta");
  await page.selectOption("#gender", "LAKI_LAKI");
  await page.selectOption("#maritalStatus", "KAWIN");
  await page.getByLabel("Mother's Maiden Name").fill("Siti Aminah");
  await page.getByLabel("KTP Number").fill("3171234567890123");
  await page.getByLabel("Address", { exact: true }).fill("Jl. Sudirman No. 1");
  await pickOccupation(page, "Karyawan Swasta");
  await page.selectOption("#sourceOfFunds", "SALARY");
  await page.selectOption("#annualIncomeRange", "FROM_100M_TO_500M");
  await page.selectOption("#netWorthRange", "FROM_500M_TO_2B");
  await page.selectOption("#transactionPurpose", "INVESTMENT");
}

async function uploadPhotos(page: Page) {
  await page.locator("#ktpFile").setInputFiles(TEST_PNG);
  await page.locator("#selfieFile").setInputFiles(TEST_PNG);
  await expect(page.getByText("Uploaded")).toHaveCount(2, { timeout: 15000 });
}

test.describe("KYC identity fields", () => {
  test.describe("positive", () => {
    test("every new identity control is on the form and a full submit goes through", async ({
      page,
    }) => {
      await gotoKyc(page);
      for (const id of ["#identityType", "#nationality", "#gender", "#maritalStatus"]) {
        await expect(page.locator(id)).toBeVisible();
      }
      await expect(page.getByLabel("Mother's Maiden Name")).toBeVisible();
      await expect(page.getByLabel("Alias / Other Name (optional)")).toBeVisible();

      await fillEverything(page);
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({ timeout: 15000 });
    });

    test("nationality defaults to ID and is separate from country of residence", async ({
      page,
    }) => {
      await gotoKyc(page);
      // kyc.yaml: `country` = negara alamat tinggal (dikunci ID di Phase 2 awal),
      // `nationality` = kewarganegaraan orangnya. Dua jawaban, bukan satu.
      await expect(page.getByLabel("Nationality")).toHaveValue("ID");
      await expect(page.getByLabel("Nationality")).toBeEditable();
      await expect(page.getByLabel("Country")).toHaveValue("ID");
      await expect(page.getByLabel("Country")).not.toBeEditable();
    });

    test("the Indonesian UI uses KTP wording for gender and marital status", async ({
      page,
    }) => {
      await gotoKyc(page, "id");
      await expect(page.getByLabel("Jenis Kelamin")).toBeVisible();
      await expect(page.getByLabel("Status Perkawinan")).toBeVisible();
      await expect(page.getByLabel("Nama Gadis Ibu Kandung")).toBeVisible();
      await expect(page.locator("#gender option", { hasText: "Laki-laki" })).toHaveCount(1);
      await expect(
        page.locator("#maritalStatus option", { hasText: "Cerai Hidup" }),
      ).toHaveCount(1);
    });
  });

  test.describe("negative", () => {
    test("leaving a new required field empty names it and blocks the submit", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillEverything(page);
      await page.selectOption("#gender", "");
      await page.getByLabel("Mother's Maiden Name").fill("");
      await uploadPhotos(page);

      const submit = page.getByRole("button", { name: "Submit for Verification" });
      await submit.click();

      await expect(page.getByText("Gender is required")).toBeVisible();
      await expect(page.getByText("Mother's maiden name is required")).toBeVisible();
      // Bukan hanya pesannya: tombolnya juga mati sampai keduanya diperbaiki.
      await expect(submit).toBeDisabled();
      await expect(page.getByText("Verification in review")).toBeHidden();
    });

    test("a bad nationality code is rejected by name", async ({ page }) => {
      await gotoKyc(page);
      await fillEverything(page);
      // Satu huruf, bukan tiga: input-nya `maxLength={2}`, jadi "IDN" tidak akan
      // pernah masuk — yang bisa terjadi di dunia nyata adalah kode setengah jadi.
      await page.getByLabel("Nationality").fill("I");
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Submit for Verification" }).click();

      await expect(
        page.getByText("Nationality must be a two-letter country code (e.g. ID)"),
      ).toBeVisible();
      await expect(page.getByText("Verification in review")).toBeHidden();
    });

    test("driver's licence is not offered — Art. 26(2) does not recognise it for CDD", async ({
      page,
    }) => {
      await gotoKyc(page);
      const values = await page.$$eval("#identityType option", (els) =>
        els.map((el) => (el as HTMLOptionElement).value),
      );
      // Dulu `["", "KTP", "PASSPORT"]`. Opsi kosong terdepan HILANG sejak
      // placeholder Versi 4 (papan Figma `40 · KYC` baris 9: "Select selalu punya
      // nilai, placeholder tidak pernah tampil") — `identityType` mulai di `KTP`
      // lewat `EMPTY_IDENTITY_FORM`, jadi opsi kosong itu bukan cuma tak pernah
      // terlihat, ia jawaban yang bisa DIPILIH ULANG nasabah dan tidak akan pernah
      // lolos `isIdentityNumberValid`. `KycSelect` sekarang hanya merender opsi
      // kosong kalau diberi prop `placeholder`, dan di sini sengaja tidak.
      //
      // Assertion ini TIDAK dilonggarkan: ia tetap membuktikan maksud tesnya (SIM
      // tidak ditawarkan, Pasal 26 ayat (2)) lewat perbandingan yang sama-sama
      // persis, dan sekarang sekalian membuktikan tidak ada jawaban kosong.
      expect(values).toEqual(["KTP", "PASSPORT"]);
    });
  });

  test.describe("edge cases", () => {
    test("choosing a passport swaps the label and drops the 16-digit rule", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillEverything(page);
      await expect(page.getByLabel("KTP Number")).toBeVisible();

      await page.selectOption("#identityType", "PASSPORT");
      // Label, dokumen yang diminta, dan aturan panjangnya ikut berubah.
      await expect(page.getByLabel("Passport Number")).toBeVisible();
      await expect(page.getByLabel("KTP Number")).toHaveCount(0);
      await expect(page.getByLabel("Passport Photo Page")).toBeVisible();

      await page.getByLabel("Passport Number").fill("C1234567");
      await page.getByLabel("Nationality").fill("SG");
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Submit for Verification" }).click();

      await expect(page.getByText("KTP number must be 16 digits")).toBeHidden();
      await expect(page.getByText("Verification in review")).toBeVisible({ timeout: 15000 });
    });

    test("an 8-character number is rejected for KTP and accepted for a passport", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillEverything(page);
      await page.getByLabel("KTP Number").fill("C1234567");
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("KTP number must be 16 digits")).toBeVisible();

      await page.selectOption("#identityType", "PASSPORT");
      await expect(page.getByText("KTP number must be 16 digits")).toBeHidden();
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({ timeout: 15000 });
    });

    test("alias is optional — an empty one still submits", async ({ page }) => {
      await gotoKyc(page);
      await fillEverything(page);
      await uploadPhotos(page);
      // Butir a) berbunyi "termasuk nama alias, JIKA ADA": kosong adalah jawaban
      // lengkap, bukan pengajuan yang kurang.
      await expect(page.getByLabel("Alias / Other Name (optional)")).toHaveValue("");
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({ timeout: 15000 });
    });

    test("PENDING disables the new identity controls along with the rest", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedKycStatus(page, "PENDING");
      await loginViaStorage(page);
      await page.goto("/kyc");
      await expect(page.getByText("Verification in review")).toBeVisible({ timeout: 15000 });
      for (const id of ["#identityType", "#nationality", "#gender", "#maritalStatus"]) {
        await expect(page.locator(id)).toBeDisabled();
      }
      await expect(page.getByLabel("Mother's Maiden Name")).toBeDisabled();
    });
  });
});
