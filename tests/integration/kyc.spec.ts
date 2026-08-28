import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedKycStatus,
  TEST_PNG,
} from "../helpers/playwright-utils";

// /kyc (USDX-152): status banner per state, eager presigned upload with preview,
// submit gating, validation, and the REJECTED → resubmit cycle. All against the
// mock backend; the kyc status is seeded via the mock's localStorage seam.

async function gotoKyc(
  page: Page,
  status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED",
) {
  await forceEnglish(page);
  await seedKycStatus(page, status);
  await loginViaStorage(page);
  await page.goto("/kyc");
  await expect(
    page.getByRole("heading", { name: "Identity Verification" })
  ).toBeVisible({ timeout: 15000 });
}

async function fillForm(page: Page) {
  await page.getByLabel("First Name").fill("Budi");
  await page.getByLabel("Last Name").fill("Santoso");
  await page.getByLabel("Date of Birth").fill("1995-03-15");
  await page.getByLabel("Birth Place").fill("Jakarta");
  await page.getByLabel("KTP Number").fill("3171234567890123");
  await page.getByLabel("Address", { exact: true }).fill("Jl. Sudirman No. 1");
  // CDD block (USDX-545) — also required for a submit to go through. The CDD
  // rules themselves are covered in kyc-cdd.spec.ts; here it is just form fill.
  await page.selectOption("#occupation", "PRIVATE_EMPLOYEE");
  await page.selectOption("#sourceOfFunds", "SALARY");
  await page.selectOption("#annualIncomeRange", "FROM_100M_TO_500M");
  await page.selectOption("#transactionPurpose", "INVESTMENT");
}

async function uploadPhotos(page: Page) {
  await page.locator("#ktpFile").setInputFiles(TEST_PNG);
  await page.locator("#selfieFile").setInputFiles(TEST_PNG);
  // Eager upload: wait until both files report Uploaded.
  await expect(page.getByText("Uploaded")).toHaveCount(2, { timeout: 15000 });
}

test.describe("KYC Page", () => {
  test.describe("positive", () => {
    test("UNVERIFIED shows the form with submit disabled until complete", async ({
      page,
    }) => {
      await gotoKyc(page, "UNVERIFIED");
      const submit = page.getByRole("button", { name: "Submit for Verification" });
      await expect(submit).toBeVisible();
      await expect(submit).toBeDisabled();

      await fillForm(page);
      await expect(submit).toBeDisabled(); // photos still missing

      await uploadPhotos(page);
      await expect(submit).toBeEnabled();
    });

    test("valid submit flips the banner to PENDING and disables the form", async ({
      page,
    }) => {
      await gotoKyc(page, "UNVERIFIED");
      await fillForm(page);
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({
        timeout: 15000,
      });
      // PENDING: form stays visible but disabled.
      await expect(page.getByLabel("First Name")).toBeDisabled();
    });

    test("PENDING shows in-review banner with a visible but disabled form", async ({
      page,
    }) => {
      await gotoKyc(page, "PENDING");
      await expect(page.getByText("Verification in review")).toBeVisible();
      await expect(page.getByLabel("First Name")).toBeVisible();
      await expect(page.getByLabel("First Name")).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Submit for Verification" })
      ).toBeDisabled();
    });

    test("VERIFIED hides the form and links to the dashboard", async ({ page }) => {
      await gotoKyc(page, "VERIFIED");
      await expect(page.getByText("Your identity is verified")).toBeVisible();
      await expect(page.getByLabel("First Name")).toBeHidden();
      const link = page.getByRole("link", { name: "Go to Dashboard" });
      await expect(link).toHaveAttribute("href", "/mint");
    });

    test("REJECTED shows reason + Submit Again button that reactivates the form", async ({
      page,
    }) => {
      await gotoKyc(page, "REJECTED");
      await expect(page.getByText("Verification rejected")).toBeVisible();
      await expect(
        page.getByText("Foto KTP buram, mohon submit ulang.")
      ).toBeVisible();
      // Form hidden until the user opts into resubmitting.
      await expect(page.getByLabel("First Name")).toBeHidden();
      await page.getByRole("button", { name: "Submit Again" }).click();
      await expect(page.getByLabel("First Name")).toBeVisible();
      await expect(page.getByLabel("First Name")).toBeEnabled();
    });
  });

  test.describe("negative", () => {
    test("oversized file is rejected client-side", async ({ page }) => {
      await gotoKyc(page, "UNVERIFIED");
      await page.locator("#ktpFile").setInputFiles({
        name: "big.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 1),
      });
      await expect(page.getByText("File is too large (max 5 MB)")).toBeVisible();
    });

    test("non-image file (PDF) is rejected client-side", async ({ page }) => {
      await gotoKyc(page, "UNVERIFIED");
      await page.locator("#ktpFile").setInputFiles({
        name: "doc.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4"),
      });
      await expect(
        page.getByText("Only JPG, PNG, or HEIC images are allowed")
      ).toBeVisible();
    });

    test("15-digit KTP number shows inline error", async ({ page }) => {
      await gotoKyc(page, "UNVERIFIED");
      await fillForm(page);
      await page.getByLabel("KTP Number").fill("317123456789012"); // 15 digits
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Submit for Verification" }).click();
      await expect(page.getByText("KTP number must be 16 digits")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("resubmit after REJECTED goes back to PENDING", async ({ page }) => {
      await gotoKyc(page, "REJECTED");
      await page.getByRole("button", { name: "Submit Again" }).click();
      await fillForm(page);
      await uploadPhotos(page);
      await page.getByRole("button", { name: "Resubmit" }).click();
      await expect(page.getByText("Verification in review")).toBeVisible({
        timeout: 15000,
      });
    });
  });
});

test.describe("KYC Responsive (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("form renders fully on desktop", async ({ page }) => {
    await gotoKyc(page, "UNVERIFIED");
    await expect(page.getByLabel("First Name")).toBeVisible();
    await expect(page.getByLabel("Identity Type")).toHaveValue("KTP");
    await expect(page.getByLabel("Country")).toHaveValue("ID");
    await expect(
      page.getByRole("button", { name: "Submit for Verification" })
    ).toBeVisible();
  });
});

test.describe("KYC Responsive (375)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("form is usable on mobile without horizontal scroll", async ({ page }) => {
    await gotoKyc(page, "UNVERIFIED");
    await expect(page.getByLabel("First Name")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit for Verification" })
    ).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
