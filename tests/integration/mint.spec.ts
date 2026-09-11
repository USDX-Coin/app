import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
// Seeded address-book entry (mock) — "Demo Wallet".
const SEEDED_ADDRESS = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

// Mint flow (USDX-201): form -> Ringkasan modal -> checkout redirect.
// Phase 2 = Polygon-only; live rate from GET /v2/rate (mock effectiveBuyRate 16,400).
// Limits and fees come from GET /api/v2/config (USDX-638): mock minMintIdr
// Rp 20.000, mintFeePct 1%, pgFeeVaFlat Rp 4.000.
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await page.goto("/mint");
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
});

test.describe("Mint Page", () => {
  test.describe("positive", () => {
    test("displays mint form locked to Polygon with the live rate", async ({ page }) => {
      await expect(page.getByText("You will pay")).toBeVisible();
      await expect(page.getByPlaceholder("0", { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toBeVisible();
      // Chain is locked to Polygon — its badge shows on the USDX chip.
      await expect(page.locator('img[src="/icon/polygon.svg"]').first()).toBeVisible();
      await expect(page.getByText("1 USDX ≈ 16,400 IDR")).toBeVisible();
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

    test("the review shows the VA fee and a total that includes it", async ({ page }) => {
      // Rp 20.000 mint value: 1% mint fee = Rp 200, flat VA fee Rp 4.000,
      // total Rp 24.200. Before USDX-638 this screen printed Rp 20.000 under
      // "Total Payment" and only promised a fee at the next origin.
      await page.getByRole("button", { name: "Swap currency" }).click();
      await page.getByPlaceholder("0", { exact: true }).fill("20000");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();

      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("VA fee", { exact: true })).toBeVisible();
      await expect(page.getByText("Rp 4.000")).toBeVisible();
      await expect(page.getByText("≈ Rp 24.200")).toBeVisible();
      // The old copy named a channel that never ships (provider declined QRIS).
      await expect(page.getByText("QRIS")).toHaveCount(0);
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
      // 1 USDX = Rp 16.400 — the same purchase, the other box. It used to be
      // judged against a 10-USDX floor and reported as "Minimum mint is 10 USDX".
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
      // 1000 USDX × 16,400 IDR
      await expect(page.getByText("16,400,000")).toBeVisible();
      await expect(page.getByText("You will pay")).toBeVisible();
    });

    // Swapping moves which side you type in, not how much you are buying. It used
    // to carry the digits across unchanged, so Rp 19.000 came back as 19.000 USDX
    // — a purchase ~16,000x bigger than the one on screen (USDX-650).
    test("swapping converts the amount instead of relabelling it", async ({ page }) => {
      const amount = page.getByPlaceholder("0", { exact: true });
      const swap = page.getByRole("button", { name: "Swap currency" });

      await swap.click(); // denominate in IDR
      await amount.fill("19000");
      await expect(page.getByText("1.16")).toBeVisible(); // 19,000 / 16,400

      await swap.click(); // now type in USDX

      // The field holds the equivalent, not the rupiah digits.
      await expect(amount).toHaveValue("1.158537");
      await expect(page.getByText("19,000", { exact: true })).toBeVisible();
      await expect(page.getByText("308,750,000")).toHaveCount(0);
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
});
