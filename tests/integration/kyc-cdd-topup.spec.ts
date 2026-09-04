import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  pickOccupation,
  seedKycStatus,
  seedKycCddComplete,
} from "../helpers/playwright-utils";

// /kyc CDD top-up for an ALREADY-VERIFIED customer (USDX-545, Wisnu 27 Aug 2026):
// notified and allowed to complete the CDD, not gated at transaction time and not
// left alone. The risk being tested is a STATUS REGRESSION — a verified customer
// must not be able to fall back to PENDING through this flow.

const PENDING_BANNER = "Verification in review";
const VERIFIED_BANNER = "Your identity is verified";
const NPWP_SENTINEL = "091234567890000";
const PEP_SENTINEL = "Ayah-KepalaDinasSentinel";

async function gotoVerified(
  page: Page,
  opts: { cddComplete?: boolean; locale?: "en" | "id" } = {},
) {
  if (opts.locale === "id") await forceIndonesian(page);
  else await forceEnglish(page);
  await seedKycStatus(page, "VERIFIED");
  await seedKycCddComplete(page, opts.cddComplete ?? false);
  await loginViaStorage(page, { kycStatus: "VERIFIED" });
  await page.goto("/kyc");
  await expect(
    page.getByRole("heading", {
      name: opts.locale === "id" ? "Verifikasi Identitas" : "Identity Verification",
    }),
  ).toBeVisible({ timeout: 15000 });
}

const topUp = (page: Page) => page.getByTestId("kyc-cdd-topup");

async function fillCdd(page: Page) {
  await pickOccupation(page, "Pegawai Negeri Sipil (PNS)");
  await page.selectOption("#sourceOfFunds", "SALARY");
  await page.selectOption("#annualIncomeRange", "UNDER_100M");
  await page.selectOption("#netWorthRange", "UNDER_500M");
  await page.selectOption("#transactionPurpose", "PAYMENT");
}

async function dumpWebStorage(page: Page) {
  return page.evaluate(() => {
    const read = (store: Storage) =>
      Object.keys(store)
        .map((key) => `${key}=${store.getItem(key)}`)
        .join("\n");
    return `${read(localStorage)}\n${read(sessionStorage)}`;
  });
}

test.describe("KYC CDD top-up (VERIFIED customer)", () => {
  test.describe("positive", () => {
    test("VERIFIED with CDD missing is told what is left and can fill just that", async ({
      page,
    }) => {
      await gotoVerified(page);
      await expect(topUp(page)).toBeVisible();
      await expect(topUp(page)).toContainText("Complete your customer profile");
      // Says what is missing and why, by name.
      await expect(topUp(page)).toContainText("occupation");
      await expect(topUp(page)).toContainText("source of funds");
      await expect(topUp(page)).toContainText("net worth");
      await expect(topUp(page)).toContainText("NPWP");
      // Every due-diligence control, plus NPWP, the workplace pair and the PEP box.
      for (const id of [
        "#occupation",
        "#sourceOfFunds",
        "#annualIncomeRange",
        "#netWorthRange",
        "#transactionPurpose",
        "#employerAddress",
        "#employerPhone",
        "#npwp",
        "#pepStatus",
      ]) {
        await expect(page.locator(id)).toBeVisible();
      }
    });

    test("the identity block is NOT re-requested", async ({ page }) => {
      await gotoVerified(page);
      await expect(topUp(page)).toBeVisible();
      // Already accepted — asking again would treat a top-up as a re-application.
      for (const label of [
        "First Name",
        "Last Name",
        "Date of Birth",
        "Birth Place",
        "KTP Number",
        // USDX-586: the five new identity fields are NOT reachable from here either.
        // kyc.yaml is explicit that PATCH /api/v2/kyc/cdd must not be able to change
        // approved identity data — that gap is a PM decision (Art. 51 periodic
        // refresh), not something the app patches from its side.
        "Nationality",
        "Gender",
        "Marital Status",
        "Mother's Maiden Name",
        "Alias / Other Name (optional)",
      ]) {
        await expect(page.getByLabel(label)).toHaveCount(0);
      }
      await expect(page.locator("#ktpFile")).toHaveCount(0);
      await expect(page.locator("#selfieFile")).toHaveCount(0);
      // And no route back to the full submit.
      await expect(
        page.getByRole("button", { name: "Submit for Verification" }),
      ).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Resubmit" })).toHaveCount(0);
    });

    test("saving the CDD keeps the customer VERIFIED and retires the form", async ({
      page,
    }) => {
      await gotoVerified(page);
      await fillCdd(page);
      await page.getByRole("button", { name: "Save profile details" }).click();

      await expect(
        page.getByText("your profile details have been saved"),
      ).toBeVisible({ timeout: 15000 });
      // Still verified, and the top-up is gone because CDD is now on record.
      await expect(page.getByText(VERIFIED_BANNER)).toBeVisible();
      await expect(topUp(page)).toBeHidden();
    });

    test("the Indonesian copy is used in the ID locale", async ({ page }) => {
      await gotoVerified(page, { locale: "id" });
      await expect(topUp(page)).toContainText("Lengkapi profil nasabah Anda");
      await expect(topUp(page)).toContainText("Akses Anda tidak berubah");
      await expect(
        page.getByRole("button", { name: "Simpan Data Profil" }),
      ).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("ZERO STATUS CHANGE: the flow can never put a VERIFIED customer into PENDING", async ({
      page,
    }) => {
      await gotoVerified(page);
      await expect(page.getByText(PENDING_BANNER)).toBeHidden();

      await fillCdd(page);
      await page.getByRole("button", { name: "Save profile details" }).click();
      await expect(
        page.getByText("your profile details have been saved"),
      ).toBeVisible({ timeout: 15000 });

      // Not in review — before, after, or on a reload.
      await expect(page.getByText(PENDING_BANNER)).toBeHidden();
      await page.reload();
      await expect(page.getByText(VERIFIED_BANNER)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(PENDING_BANNER)).toBeHidden();
      // The persisted mock status was never moved off VERIFIED.
      expect(
        await page.evaluate(() => localStorage.getItem("usdx-mock-kyc-status")),
      ).toBe("VERIFIED");
    });

    test("the notice informs, it does not threaten", async ({ page }) => {
      await gotoVerified(page);
      // Load-bearing reassurance: nothing is gated on this.
      await expect(topUp(page)).toContainText("Your access does not change");
      await expect(topUp(page)).toContainText("keep minting and redeeming as usual");
      const text = await topUp(page).innerText();
      for (const threat of ["restricted", "suspended", "blocked", "will be limited"]) {
        expect(text.toLowerCase(), `notice reads as a threat ("${threat}")`).not.toContain(
          threat,
        );
      }
    });

    test("empty CDD is rejected by field name, and nothing is submitted", async ({
      page,
    }) => {
      await gotoVerified(page);
      await page.getByRole("button", { name: "Save profile details" }).click();

      await expect(page.getByText("Occupation is required")).toBeVisible();
      await expect(page.getByText("Source of funds is required")).toBeVisible();
      await expect(page.getByText("Annual income is required")).toBeVisible();
      await expect(page.getByText("Net worth is required")).toBeVisible();
      await expect(page.getByText("Transaction purpose is required")).toBeVisible();
      await expect(
        page.getByText("your profile details have been saved"),
      ).toBeHidden();
      await expect(topUp(page)).toBeVisible();
    });

    test("declaring PEP without the relation is rejected here too", async ({ page }) => {
      await gotoVerified(page);
      await fillCdd(page);
      await page.getByLabel(/holds a public office/).check();
      await page.getByRole("button", { name: "Save profile details" }).click();

      await expect(page.getByText("PEP relationship is required")).toBeVisible();
      await expect(page.getByText("Source of wealth is required")).toBeVisible();
      await expect(
        page.getByText("your profile details have been saved"),
      ).toBeHidden();
    });
  });

  test.describe("edge cases", () => {
    test("VERIFIED with CDD already on record sees no form and no notice", async ({
      page,
    }) => {
      await gotoVerified(page, { cddComplete: true });
      await expect(page.getByText(VERIFIED_BANNER)).toBeVisible();
      await expect(topUp(page)).toHaveCount(0);
      await expect(page.getByTestId("occupation-trigger")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Go to Dashboard" }),
      ).toHaveAttribute("href", "/mint");
    });

    test("the PEP relation stays conditional on the top-up form", async ({ page }) => {
      await gotoVerified(page);
      const relation = page.getByLabel("Relationship and office held");
      const sourceOfWealth = page.locator("#sourceOfWealth");
      await expect(relation).toBeHidden();
      await expect(sourceOfWealth).toBeHidden();
      const pep = page.getByLabel(/holds a public office/);
      await pep.check();
      await expect(relation).toBeVisible();
      await expect(sourceOfWealth).toBeVisible();
      await pep.uncheck();
      await expect(relation).toBeHidden();
      await expect(sourceOfWealth).toBeHidden();
    });

    test("NPWP and the PEP relation never reach local or session storage", async ({
      page,
    }) => {
      await gotoVerified(page);
      await fillCdd(page);
      await page.getByLabel("NPWP (optional)").fill(NPWP_SENTINEL);
      await page.getByLabel(/holds a public office/).check();
      await page.getByLabel("Relationship and office held").fill(PEP_SENTINEL);
      // Wajib begitu PEP dinyatakan (Pasal 37 (1) d) — tanpa ini submit tertahan
      // dan yang teruji tinggal separuh.
      await page.selectOption("#sourceOfWealth", "SALARY_ACCUMULATION");

      let storage = await dumpWebStorage(page);
      expect(storage).not.toContain(NPWP_SENTINEL);
      expect(storage).not.toContain(PEP_SENTINEL);

      await page.getByRole("button", { name: "Save profile details" }).click();
      await expect(
        page.getByText("your profile details have been saved"),
      ).toBeVisible({ timeout: 15000 });

      storage = await dumpWebStorage(page);
      expect(storage).not.toContain(NPWP_SENTINEL);
      expect(storage).not.toContain(PEP_SENTINEL);
    });

    test("no technical enum value leaks into the top-up UI", async ({ page }) => {
      await gotoVerified(page, { locale: "id" });
      await fillCdd(page);
      const text = await page.locator("body").innerText();
      for (const value of [
        "PEGAWAI_NEGERI_SIPIL",
        "SALARY",
        "UNDER_100M",
        "UNDER_500M",
        "PAYMENT",
        "KARYAWAN_SWASTA",
        "FROM_100M_TO_500M",
      ]) {
        expect(text, `enum member ${value} leaked into the UI`).not.toContain(value);
      }
    });
  });
});

// Regression guard for the three states this ticket must NOT have changed. The
// full-form behaviours live in kyc.spec.ts; what is asserted here is specifically
// that the CDD top-up never appears for them and the full form still does.
test.describe("KYC CDD top-up — other states unaffected", () => {
  for (const status of ["UNVERIFIED", "PENDING", "REJECTED"] as const) {
    test(`${status} never sees the CDD top-up`, async ({ page }) => {
      await forceEnglish(page);
      await seedKycStatus(page, status);
      await seedKycCddComplete(page, false); // the flag must be irrelevant here
      await loginViaStorage(page, { kycStatus: status });
      await page.goto("/kyc");
      await expect(
        page.getByRole("heading", { name: "Identity Verification" }),
      ).toBeVisible({ timeout: 15000 });

      await expect(topUp(page)).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Save profile details" }),
      ).toHaveCount(0);

      if (status === "REJECTED") {
        // Still gated behind "Submit Again", exactly as before.
        await expect(page.getByLabel("First Name")).toBeHidden();
        await page.getByRole("button", { name: "Submit Again" }).click();
      }
      // The full identity form is what these states get.
      await expect(page.getByLabel("First Name")).toBeVisible();
      await expect(page.locator("#ktpFile")).toHaveCount(1);
      await expect(page.getByTestId("occupation-trigger")).toBeVisible();
    });
  }
});
