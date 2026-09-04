import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish, seedWallet, seedRateLimit } from "../helpers/playwright-utils";

// 429 RATE_LIMITED (mint/redeem throughput throttle, USDX-252). With the throttle
// seam armed, the redeem create returns 429 → a central toast shows and the user
// is NOT logged out (429 ≠ 401). Distinct from the auth 429 countdown.
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await seedWallet(page);
  await seedRateLimit(page, 3); // every mint/redeem call → 429 RATE_LIMITED
  await loginViaStorage(page);
});

test.describe("Rate limit (429 RATE_LIMITED)", () => {
  test.describe("positive", () => {
    test("redeem create under throttle shows a toast and keeps the user signed in", async ({ page }) => {
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByRole("combobox", { name: "Select bank" }).click();
      await page.getByText("BCA", { exact: true }).click();
      await page.getByPlaceholder("1234567890").fill("1234563210");
      await page.getByPlaceholder("As printed on the passbook").fill("SINGGIH BRILIAN TARA");

      const redeem = page.getByRole("button", { name: "Redeem", exact: true });
      await redeem.click(); // contextual connect (seam)
      await redeem.click(); // open Ringkasan
      await expect(page.getByText("Transaction Summary")).toBeVisible();

      // Confirm & Burn → POST /v2/redeem returns 429 RATE_LIMITED.
      await page.getByRole("button", { name: "Confirm & Burn" }).click();

      // Central throttle toast appears…
      await expect(
        page.getByText("Too many requests, please try again shortly."),
      ).toBeVisible({ timeout: 15000 });
      // …and the user stays on /redeem (429 does not logout, unlike 401).
      await expect(page).toHaveURL(/\/redeem/);
    });
  });
});
