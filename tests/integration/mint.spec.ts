import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  seedPaymentMethods,
} from "../helpers/playwright-utils";

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
// Seeded address-book entry (mock) — "Demo Wallet".
const SEEDED_ADDRESS = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

// Mint flow (USDX-201): form -> Ringkasan modal -> checkout redirect.
// Phase 2 = Polygon-only. D25 rev-15: two buy rates from GET /v2/rate (mock
// Transfer BNI 15.950, Virtual Account 16.160); the form converts with the
// cheapest OFFERED one (`paymentMethods[]` from GET /api/v2/config, mock = both).
// Mock minMintIdr Rp 20.000.
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await page.goto("/mint");
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
});

test.describe("Mint Page", () => {
  test.describe("positive", () => {
    test("displays mint form locked to Polygon with 'Worth' + 'See rates'", async ({ page }) => {
      await expect(page.getByText("Worth", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "See rates" })).toBeVisible();
      await expect(page.getByPlaceholder("0", { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toBeVisible();
      // Chain is locked to Polygon — its badge shows on the USDX chip.
      await expect(page.locator('img[src="/icon/polygon.svg"]').first()).toBeVisible();
      // The old single-rate line is gone: the rates sit behind "See rates".
      await expect(page.getByText(/1 USDX ≈/)).toHaveCount(0);
    });

    test("'See rates' lists both rates, the wondr time and the method note", async ({ page }) => {
      await page.getByRole("button", { name: "See rates" }).click();
      const details = page.getByTestId("mint-rate-details");
      await expect(details).toBeVisible();
      await expect(page.getByTestId("mint-rate-bni")).toContainText("BNI Transfer rate");
      await expect(page.getByTestId("mint-rate-bni")).toContainText("Rp 15.950");
      await expect(page.getByTestId("mint-rate-bni")).toContainText(
        "as in the wondr by BNI app · updated 09.15 WIB",
      );
      await expect(page.getByTestId("mint-rate-va")).toContainText("Virtual Account rate");
      await expect(page.getByTestId("mint-rate-va")).toContainText("Rp 16.160");
      await expect(details).toContainText("You choose the method on the payment page.");
    });

    test("Indonesian copy: 'Anda akan mint', 'Senilai', 'Lihat kurs'", async ({ page }) => {
      await forceIndonesian(page);
      await page.goto("/mint");
      await expect(page.getByText("Anda akan mint")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Senilai", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Lihat kurs" }).click();
      await expect(page.getByTestId("mint-rate-details")).toContainText(
        "Metode dipilih di halaman pembayaran.",
      );
      await expect(page.getByTestId("mint-rate-bni")).toContainText(
        "sesuai aplikasi wondr by BNI · diperbarui 09.15 WIB",
      );
    });

    test("Mint button enabled when form is valid", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeEnabled();
    });

    test("opens the Ringkasan modal with correct data", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("500");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("500 USDX").first()).toBeVisible();
    });

    test("the review shows the conversion rate and no fee or total", async ({ page }) => {
      // D25 rev-15: the total per method (with fees) is only known — and shown —
      // in checkout, after the method is chosen. The review keeps "Exchange rate"
      // = the cheapest offered rate the USDX amount was converted with.
      await page.getByRole("button", { name: "Swap currency" }).click();
      await page.getByPlaceholder("0", { exact: true }).fill("20000");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Transaction Summary")).toBeVisible();
      await expect(dialog.getByText("1 USDX ≈ Rp 15.950")).toBeVisible();
      await expect(dialog.getByText("VA fee", { exact: true })).toHaveCount(0);
      await expect(dialog.getByText(/Total Payment/)).toHaveCount(0);
      await expect(dialog.getByText("QRIS")).toHaveCount(0);
    });

    test("Rp 20.000 typed on the rupiah side is accepted", async ({ page }) => {
      await page.getByRole("button", { name: "Swap currency" }).click();
      await page.getByPlaceholder("0", { exact: true }).fill("20000");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);

      await expect(page.getByText("Minimum mint value is")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeEnabled();
    });

    test("picks a destination from the address book", async ({ page }) => {
      await page.getByRole("button", { name: "Add address book" }).click();
      await expect(page.getByRole("heading", { name: "Address book" })).toBeVisible();
      await page.getByText("Demo Wallet").click();
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toHaveValue(SEEDED_ADDRESS);
    });
  });

  test.describe("negative", () => {
    test("Mint button disabled when form is empty", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });

    test("Rp 19.000 on the rupiah side reports the rupiah minimum", async ({ page }) => {
      await page.getByRole("button", { name: "Swap currency" }).click();
      await page.getByPlaceholder("0", { exact: true }).fill("19000");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);

      await expect(page.getByText("Minimum mint value is Rp 20.000")).toBeVisible();
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });

    test("the same amount typed on the USDX side reports the same error", async ({ page }) => {
      // 1 USDX = Rp 15.950 (Rp 16.160 at the VA rate) — under the floor either
      // way. It used to be judged against a 10-USDX floor ("Minimum mint is 10 USDX").
      await page.getByPlaceholder("0", { exact: true }).fill("1");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);

      await expect(page.getByText("Minimum mint value is Rp 20.000")).toBeVisible();
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });

    test("shows max amount error", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("9999999");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);
      await expect(page.getByText("Maximum mint is 1,000,000 USDX")).toBeVisible();
    });

    test("keeps Mint disabled for an invalid address", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill("notanaddress");
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });

    test("shows inline error and stays on /mint when recipient is blacklisted (422)", async ({ page }) => {
      // Sentinel address the mock rejects with 422 RECIPIENT_BLACKLISTED (mirrors BE pre-check).
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page
        .getByPlaceholder("0x5DC489Ad05Efc")
        .fill("0x000000000000000000000000000000000000dead");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await expect(page.getByText("This destination address can't receive USDX")).toBeVisible();
      await expect(page).toHaveURL(/\/mint$/);
    });
  });

  test.describe("edge cases", () => {
    test("auto-calculates the IDR payment amount", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("1000");
      // 1000 USDX × 15.950 (cheapest offered rate), Indonesian digits
      await expect(page.getByText("15.950.000")).toBeVisible();
      await expect(page.getByText("Worth", { exact: true })).toBeVisible();
    });

    // Swapping moves which side you type in, not how much you are buying. It used
    // to carry the digits across unchanged, so Rp 19.000 came back as 19.000 USDX
    // — a purchase ~16,000x bigger than the one on screen (USDX-650).
    test("swapping converts the amount instead of relabelling it", async ({ page }) => {
      const amount = page.getByPlaceholder("0", { exact: true });
      const swap = page.getByRole("button", { name: "Swap currency" });

      await swap.click(); // denominate in IDR
      await amount.fill("19000");
      await expect(page.getByText("1.19")).toBeVisible(); // 19,000 / 15,950

      await swap.click(); // now type in USDX

      // The field holds the equivalent, not the rupiah digits.
      await expect(amount).toHaveValue("1.191223");
      await expect(page.getByText("19.000", { exact: true })).toBeVisible();
      await expect(page.getByText("303.050.000")).toHaveCount(0);
    });

    test("swapping back and forth does not move the amount", async ({ page }) => {
      const amount = page.getByPlaceholder("0", { exact: true });
      const swap = page.getByRole("button", { name: "Swap currency" });

      await swap.click();
      await amount.fill("19000");

      for (let i = 0; i < 5; i++) {
        await swap.click();
        await swap.click();
      }

      await expect(amount).toHaveValue("19000");
    });
  });

  // Which methods are offered is the back office's call (rev-16), read from
  // GET /api/v2/config — the form never assumes one exists.
  test.describe("offered methods", () => {
    test("Transfer BNI not offered → VA rate converts, no BNI row", async ({ page }) => {
      await seedPaymentMethods(page, ["VA"]);
      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });

      await page.getByPlaceholder("0", { exact: true }).fill("1000");
      await expect(page.getByText("16.160.000")).toBeVisible();
      await page.getByRole("button", { name: "See rates" }).click();
      await expect(page.getByTestId("mint-rate-va")).toContainText("Rp 16.160");
      await expect(page.getByTestId("mint-rate-bni")).toHaveCount(0);
    });

    test("no method offered → notice up front, form closed", async ({ page }) => {
      await seedPaymentMethods(page, []);
      await page.goto("/mint");
      await expect(page.getByTestId("mint-disabled-notice")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("mint-disabled-notice")).toContainText(
        "Minting isn't available yet",
      );
      await expect(page.getByPlaceholder("0", { exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "See rates" })).toHaveCount(0);
    });
  });
});
