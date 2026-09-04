import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  pickOccupation,
  seedKycStatus,
  TEST_PNG,
} from "../helpers/playwright-utils";

// /kyc CDD block (USDX-545, extended USDX-586): the due-diligence answers, the PEP
// declaration with its conditional relation AND source of wealth, the optional
// workplace details and NPWP, plus the searchable 99-value occupation picker. Runs
// against the mock backend via the existing localStorage seams.

/**
 * Every technical enum member that must never be rendered as UI text. Asserted in
 * the INDONESIAN locale, where no label shares a word with its value — in English
 * "Salary"/`SALARY` differ only by case, which would make the check toothless.
 */
const ENUM_VALUES = [
  "KARYAWAN_SWASTA",
  "WIRASWASTA",
  "PEGAWAI_NEGERI_SIPIL",
  "BELUM_TIDAK_BEKERJA",
  "SALARY",
  "BUSINESS",
  "INHERITANCE",
  "UNDER_100M",
  "FROM_100M_TO_500M",
  "FROM_500M_TO_1B",
  "OVER_1B",
  "UNDER_500M",
  "FROM_500M_TO_2B",
  "OVER_10B",
  "INVESTMENT",
  "PAYMENT",
  "REMITTANCE",
  "OTHER",
  "SALARY_ACCUMULATION",
  "PROPERTY_SALE",
] as const;

/**
 * `<select>` yang tersisa: placeholder (4) + anggota (5 + 4 + 4 + 4). Pekerjaan
 * TIDAK ikut dihitung — sejak USDX-586 ia combobox pencarian, bukan `<select>`.
 */
const TOTAL_CDD_OPTIONS = 21;

// Distinctive so a storage scan can prove they were never persisted.
const NPWP_SENTINEL = "091234567890000";
const PEP_SENTINEL = "Ayah-KepalaDinasSentinel";

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

async function fillIdentity(page: Page) {
  await page.getByLabel("First Name").fill("Budi");
  await page.getByLabel("Last Name").fill("Santoso");
  await page.getByLabel("Date of Birth").fill("1995-03-15");
  await page.getByLabel("Birth Place").fill("Jakarta");
  await page.getByLabel("KTP Number").fill("3171234567890123");
  await page.getByLabel("Address", { exact: true }).fill("Jl. Sudirman No. 1");
}

async function fillIdentityExtras(page: Page) {
  await page.selectOption("#gender", "LAKI_LAKI");
  await page.selectOption("#maritalStatus", "KAWIN");
  await page.getByLabel("Mother's Maiden Name").fill("Siti Aminah");
}

async function fillCdd(page: Page) {
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

/** Everything this browser profile has in local + session storage, flattened. */
async function dumpWebStorage(page: Page) {
  return page.evaluate(() => {
    const read = (store: Storage) =>
      Object.keys(store)
        .map((key) => `${key}=${store.getItem(key)}`)
        .join("\n");
    return `${read(localStorage)}\n${read(sessionStorage)}`;
  });
}

test.describe("KYC CDD fields", () => {
  test.describe("positive", () => {
    test("every due-diligence control is present and submit succeeds once answered", async ({
      page,
    }) => {
      await gotoKyc(page);
      for (const id of [
        "#occupation",
        "#sourceOfFunds",
        "#annualIncomeRange",
        "#netWorthRange",
        "#transactionPurpose",
      ]) {
        await expect(page.locator(id)).toBeVisible();
      }

      await fillIdentity(page);
      await fillIdentityExtras(page);
      await fillCdd(page);
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({
        timeout: 15000,
      });
    });

    test("NPWP is optional — submit goes through with it empty", async ({ page }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillIdentityExtras(page);
      await fillCdd(page);
      await uploadPhotos(page);
      await expect(page.getByLabel("NPWP (optional)")).toHaveValue("");
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({
        timeout: 15000,
      });
    });

    test("the Indonesian UI shows Indonesian labels, not the enum members", async ({
      page,
    }) => {
      await gotoKyc(page, "id");
      await expect(page.getByText("Profil Nasabah")).toBeVisible();
      await expect(page.getByLabel("Pekerjaan")).toBeVisible();
      await expect(page.getByLabel("Sumber Dana")).toBeVisible();
      await expect(page.getByLabel("Penghasilan per Tahun")).toBeVisible();
      await expect(page.getByLabel("Nilai Harta Kekayaan")).toBeVisible();
      await expect(page.getByLabel("Tujuan Transaksi")).toBeVisible();

      // Option text, not option value.
      await expect(
        page.locator("#annualIncomeRange option", { hasText: "Rp 100 juta - Rp 500 juta" }),
      ).toHaveCount(1);
      await expect(
        page.locator("#netWorthRange option", { hasText: "Rp 500 juta - Rp 2 miliar" }),
      ).toHaveCount(1);
      // Pekerjaan: label Permendagri apa adanya, tidak diterjemahkan ulang.
      await pickOccupation(page, "Karyawan Swasta");
    });
  });

  test.describe("negative", () => {
    test("submitting with the CDD block empty is rejected, naming each field", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillIdentityExtras(page);
      await uploadPhotos(page); // identity block complete → the button is enabled
      await page.getByRole("button", { name: "Submit for Verification" }).click();

      await expect(page.getByText("Occupation is required")).toBeVisible();
      await expect(page.getByText("Source of funds is required")).toBeVisible();
      await expect(page.getByText("Annual income is required")).toBeVisible();
      await expect(page.getByText("Net worth is required")).toBeVisible();
      await expect(page.getByText("Transaction purpose is required")).toBeVisible();
      // Rejected: the status banner never flips.
      await expect(page.getByText("Verification in review")).toBeHidden();
    });

    test("one missing dropdown blocks submit and only that field is flagged", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillIdentityExtras(page);
      await fillCdd(page);
      await page.selectOption("#sourceOfFunds", ""); // back to the placeholder
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Submit for Verification" }).click();

      await expect(page.getByText("Source of funds is required")).toBeVisible();
      await expect(page.getByText("Occupation is required")).toBeHidden();
      await expect(page.getByText("Verification in review")).toBeHidden();
    });

    test("declaring PEP without the relation is rejected by name", async ({ page }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillIdentityExtras(page);
      await fillCdd(page);
      await uploadPhotos(page);
      await page.getByLabel(/holds a public office/).check();
      await page.getByRole("button", { name: "Submit for Verification" }).click();

      await expect(page.getByText("PEP relationship is required")).toBeVisible();
      // Pasal 37 (1) d: EDD berkala untuk PEP menganalisis sumber dana DAN sumber
      // kekayaan, jadi keduanya wajib begitu PEP dinyatakan.
      await expect(page.getByText("Source of wealth is required")).toBeVisible();
      await expect(page.getByText("Verification in review")).toBeHidden();
    });

    test("no technical enum value is ever rendered as visible text", async ({ page }) => {
      await gotoKyc(page, "id");
      await fillCdd(page);

      // Every <option> must carry a human label in its text and the technical
      // member only in its value attribute.
      const options = await page.$$eval(
        "#sourceOfFunds option, #annualIncomeRange option, #netWorthRange option, #transactionPurpose option",
        (els) =>
          els.map((el) => ({
            value: (el as HTMLOptionElement).value,
            text: (el.textContent ?? "").trim(),
          })),
      );
      expect(options).toHaveLength(TOTAL_CDD_OPTIONS);
      for (const { value, text } of options) {
        expect(text.length).toBeGreaterThan(0);
        if (value === "") continue;
        expect(text, `option ${value} renders its technical value`).not.toContain(value);
      }

      // And nothing else on the page leaks one either (selected value, summary…).
      const body = await page.locator("body").innerText();
      for (const value of ENUM_VALUES) {
        expect(body, `enum member ${value} leaked into the UI`).not.toContain(value);
      }
    });
  });

  test.describe("edge cases", () => {
    test("the PEP relation field appears only while PEP is declared", async ({ page }) => {
      await gotoKyc(page);
      const relation = page.getByLabel("Relationship and office held");
      const sourceOfWealth = page.locator("#sourceOfWealth");
      await expect(relation).toBeHidden();
      await expect(sourceOfWealth).toBeHidden();

      const pep = page.getByLabel(/holds a public office/);
      await pep.check();
      await expect(relation).toBeVisible();
      // Pasal 37 (1) d: sumber kekayaan ikut ditanyakan begitu PEP dinyatakan.
      await expect(sourceOfWealth).toBeVisible();

      await pep.uncheck();
      await expect(relation).toBeHidden();
      await expect(sourceOfWealth).toBeHidden();
    });

    test("un-checking PEP clears the relation instead of keeping it hidden", async ({
      page,
    }) => {
      await gotoKyc(page);
      const pep = page.getByLabel(/holds a public office/);
      await pep.check();
      await page.getByLabel("Relationship and office held").fill(PEP_SENTINEL);
      await page.selectOption("#sourceOfWealth", "SALARY_ACCUMULATION");
      await pep.uncheck();
      await pep.check();
      // Keduanya ditarik kembali, bukan sekadar disembunyikan.
      await expect(page.getByLabel("Relationship and office held")).toHaveValue("");
      await expect(page.locator("#sourceOfWealth")).toHaveValue("");
    });

    test("NPWP and the PEP relation never reach local or session storage", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillIdentityExtras(page);
      await fillCdd(page);
      await page.getByLabel("NPWP (optional)").fill(NPWP_SENTINEL);
      await page.getByLabel(/holds a public office/).check();
      await page.getByLabel("Relationship and office held").fill(PEP_SENTINEL);
      await page.selectOption("#sourceOfWealth", "SALARY_ACCUMULATION");
      await uploadPhotos(page);

      // While typing…
      let storage = await dumpWebStorage(page);
      expect(storage).not.toContain(NPWP_SENTINEL);
      expect(storage).not.toContain(PEP_SENTINEL);

      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({
        timeout: 15000,
      });

      // …and after a successful submit.
      storage = await dumpWebStorage(page);
      expect(storage).not.toContain(NPWP_SENTINEL);
      expect(storage).not.toContain(PEP_SENTINEL);
    });

    test("PENDING disables the CDD controls along with the rest of the form", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedKycStatus(page, "PENDING");
      await loginViaStorage(page);
      await page.goto("/kyc");
      await expect(page.getByText("Verification in review")).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByTestId("occupation-trigger")).toBeDisabled();
      await expect(page.locator("#netWorthRange")).toBeDisabled();
      await expect(page.locator("#pepStatus")).toBeDisabled();
      await expect(page.getByLabel("NPWP (optional)")).toBeDisabled();
    });
  });
});

// USDX-586 — pemilih pekerjaan dengan pencarian. 99 nilai Permendagri di dropdown
// polos tidak bisa dipakai manusia, jadi ini SATU-SATUNYA kontrol baru yang
// ditambahkan tiket ini. Yang diuji: penyaringan bekerja, yang tersimpan tetap
// nilai enum (bukan teks bebas), dan kotak pencarian tidak pernah jadi jawaban.
test.describe("KYC occupation picker", () => {
  const trigger = (page: Page) => page.getByTestId("occupation-trigger");
  const search = (page: Page) => page.getByPlaceholder(/Search occupation|Cari pekerjaan/);

  test.describe("positive", () => {
    test("typing filters the 99 Permendagri jobs down to the matching ones", async ({
      page,
    }) => {
      await gotoKyc(page);
      await trigger(page).click();
      // Dibatasi ke listbox milik cmdk: `<option>` dari `<select>` bawaan juga
      // ber-role "option" dan akan ikut terhitung kalau tidak dipersempit.
      const jobs = page.getByRole("listbox").getByRole("option");
      await expect(jobs).toHaveCount(99);

      // "swasta" ada di dalam DUA label ("Karyawan Swasta" dan "WiraSWASTA"), jadi
      // keduanya bertahan — penyaringannya substring, bukan awalan.
      await search(page).fill("swasta");
      await expect(page.getByRole("option", { name: "Karyawan Swasta" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Wiraswasta" })).toBeVisible();
      // Menyaring, bukan sekadar menyorot: 97 pekerjaan lain hilang dari daftar.
      await expect(jobs).toHaveCount(2);
    });

    test("a picked job is stored as its enum value, not as free text", async ({ page }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillIdentityExtras(page);
      await pickOccupation(page, "Wiraswasta");
      await page.selectOption("#sourceOfFunds", "BUSINESS");
      await page.selectOption("#annualIncomeRange", "OVER_1B");
      await page.selectOption("#netWorthRange", "OVER_10B");
      await page.selectOption("#transactionPurpose", "INVESTMENT");
      await uploadPhotos(page);

      // Tidak ada error "Pekerjaan wajib dipilih" → validator melihat anggota enum
      // yang sah, dan submit lolos.
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Occupation is required")).toBeHidden();
    });

    test("Permendagri wording is used verbatim, in both locales", async ({ page }) => {
      for (const locale of ["en", "id"] as const) {
        await gotoKyc(page, locale);
        await trigger(page).click();
        // Ejaan asli Permendagri, termasuk yang terlihat seperti salah ketik.
        for (const label of ["Karyawan Swasta", "Wiraswasta", "Cheff", "Petani/Pekebun"]) {
          await expect(page.getByRole("option", { name: label, exact: true })).toBeVisible();
        }
        await page.keyboard.press("Escape");
      }
    });
  });

  test.describe("negative", () => {
    test("text typed into the search box is never accepted as an answer", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillIdentityExtras(page);
      await page.selectOption("#sourceOfFunds", "SALARY");
      await page.selectOption("#annualIncomeRange", "UNDER_100M");
      await page.selectOption("#netWorthRange", "UNDER_500M");
      await page.selectOption("#transactionPurpose", "PAYMENT");
      await uploadPhotos(page);

      await trigger(page).click();
      await search(page).fill("Tukang Roket Antariksa");
      await expect(page.getByText(/No occupation found|Pekerjaan tidak ditemukan/)).toBeVisible();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Occupation is required")).toBeVisible();
      await expect(page.getByText("Verification in review")).toBeHidden();
    });
  });

  test.describe("edge cases", () => {
    test("the workplace pair is optional — submit succeeds with both empty", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillIdentityExtras(page);
      await fillCdd(page);
      await uploadPhotos(page);
      // Butir g) Pasal 25 (1) a angka 1 berakhir "jika ada" — nasabah yang tidak
      // bekerja tidak punya jawabannya.
      await expect(page.getByLabel("Employer Address (optional)")).toHaveValue("");
      await expect(page.getByLabel("Employer Phone (optional)")).toHaveValue("");
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({ timeout: 15000 });
    });
  });
});
