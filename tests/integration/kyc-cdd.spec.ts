import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  seedKycStatus,
  TEST_PNG,
} from "../helpers/playwright-utils";

// /kyc CDD block (USDX-545): the four due-diligence dropdowns, the PEP
// declaration and its conditional relation field, and optional NPWP. Runs against
// the mock backend via the existing localStorage seams.

/**
 * Every technical enum member that must never be rendered as UI text. Asserted in
 * the INDONESIAN locale, where no label shares a word with its value — in English
 * "Salary"/`SALARY` differ only by case, which would make the check toothless.
 */
const ENUM_VALUES = [
  "PRIVATE_EMPLOYEE",
  "SELF_EMPLOYED",
  "CIVIL_SERVANT",
  "STUDENT",
  "SALARY",
  "BUSINESS",
  "INHERITANCE",
  "UNDER_100M",
  "FROM_100M_TO_500M",
  "FROM_500M_TO_1B",
  "OVER_1B",
  "INVESTMENT",
  "PAYMENT",
  "REMITTANCE",
  "OTHER",
] as const;

/** placeholders (4) + members (5 + 5 + 4 + 4). */
const TOTAL_CDD_OPTIONS = 22;

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

async function fillCdd(page: Page) {
  await page.selectOption("#occupation", "PRIVATE_EMPLOYEE");
  await page.selectOption("#sourceOfFunds", "SALARY");
  await page.selectOption("#annualIncomeRange", "FROM_100M_TO_500M");
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
    test("all four dropdowns are present and submit succeeds once answered", async ({
      page,
    }) => {
      await gotoKyc(page);
      for (const id of [
        "#occupation",
        "#sourceOfFunds",
        "#annualIncomeRange",
        "#transactionPurpose",
      ]) {
        await expect(page.locator(id)).toBeVisible();
      }

      await fillIdentity(page);
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
      await expect(page.getByLabel("Tujuan Transaksi")).toBeVisible();

      // Option text, not option value.
      await expect(
        page.locator("#occupation option", { hasText: "Karyawan swasta" }),
      ).toHaveCount(1);
      await expect(
        page.locator("#annualIncomeRange option", { hasText: "Rp 100 juta - Rp 500 juta" }),
      ).toHaveCount(1);
    });
  });

  test.describe("negative", () => {
    test("submitting with the CDD block empty is rejected, naming each field", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await uploadPhotos(page); // identity block complete → the button is enabled
      await page.getByRole("button", { name: "Submit for Verification" }).click();

      await expect(page.getByText("Occupation is required")).toBeVisible();
      await expect(page.getByText("Source of funds is required")).toBeVisible();
      await expect(page.getByText("Annual income is required")).toBeVisible();
      await expect(page.getByText("Transaction purpose is required")).toBeVisible();
      // Rejected: the status banner never flips.
      await expect(page.getByText("Verification in review")).toBeHidden();
    });

    test("one missing dropdown blocks submit and only that field is flagged", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillIdentity(page);
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
      await fillCdd(page);
      await uploadPhotos(page);
      await page.getByLabel(/holds a public office/).check();
      await page.getByRole("button", { name: "Submit for Verification" }).click();

      await expect(page.getByText("PEP relationship is required")).toBeVisible();
      await expect(page.getByText("Verification in review")).toBeHidden();
    });

    test("no technical enum value is ever rendered as visible text", async ({ page }) => {
      await gotoKyc(page, "id");
      await fillCdd(page);

      // Every <option> must carry a human label in its text and the technical
      // member only in its value attribute.
      const options = await page.$$eval(
        "#occupation option, #sourceOfFunds option, #annualIncomeRange option, #transactionPurpose option",
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
      await expect(relation).toBeHidden();

      const pep = page.getByLabel(/holds a public office/);
      await pep.check();
      await expect(relation).toBeVisible();

      await pep.uncheck();
      await expect(relation).toBeHidden();
    });

    test("un-checking PEP clears the relation instead of keeping it hidden", async ({
      page,
    }) => {
      await gotoKyc(page);
      const pep = page.getByLabel(/holds a public office/);
      await pep.check();
      await page.getByLabel("Relationship and office held").fill(PEP_SENTINEL);
      await pep.uncheck();
      await pep.check();
      await expect(page.getByLabel("Relationship and office held")).toHaveValue("");
    });

    test("NPWP and the PEP relation never reach local or session storage", async ({
      page,
    }) => {
      await gotoKyc(page);
      await fillIdentity(page);
      await fillCdd(page);
      await page.getByLabel("NPWP (optional)").fill(NPWP_SENTINEL);
      await page.getByLabel(/holds a public office/).check();
      await page.getByLabel("Relationship and office held").fill(PEP_SENTINEL);
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
      await expect(page.locator("#occupation")).toBeDisabled();
      await expect(page.locator("#pepStatus")).toBeDisabled();
      await expect(page.getByLabel("NPWP (optional)")).toBeDisabled();
    });
  });
});
