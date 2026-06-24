import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish, seedWallet } from "../helpers/playwright-utils";

// Redeem is the only flow that needs a wallet: form -> contextual connect
// (no global button) -> Ringkasan -> sign/burn (simulated in W3) -> status
// tracker polling AWAITING_BURN -> … -> PAYOUT_COMPLETE (USDX-243).
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await seedWallet(page); // connect resolves to a mock address (no extension in CI)
  await loginViaStorage(page);
});

test.describe("Redeem Flow", () => {
  test.describe("positive", () => {
    test("form → connect → Ringkasan → burn → tracker reaches payout complete", async ({
      page,
    }) => {
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      // Fill amount + inline bank destination
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByRole("button", { name: "Select bank" }).click();
      await page.getByText("BCA", { exact: true }).click();
      await page.getByPlaceholder("Enter account number").fill("1234563210");
      await page.getByPlaceholder("Enter holder name").fill("SINGGIH BRILIAN TARA");

      // Contextual connect, then Ringkasan. The CTA is always "Redeem": first
      // click connects (seam), second click (now connected) opens the modal.
      const redeem = page.getByRole("button", { name: "Redeem", exact: true });
      await redeem.click();
      await redeem.click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText(/Burn USDX cannot be undone/)).toBeVisible();

      // Confirm & Burn → status tracker
      await page.getByRole("button", { name: "Confirm & Burn" }).click();
      await expect(page.getByText(/Simulation mode/)).toBeVisible({ timeout: 15000 });
      // Mock lifecycle auto-completes a few seconds after the burn.
      await expect(page.getByText("Payout complete")).toBeVisible({ timeout: 20000 });
      await expect(page.getByText("Burn transaction")).toBeVisible();
      await expect(page.getByRole("button", { name: "Back to Redeem" })).toBeVisible();
    });

    // Saved-account path (USDX-267): pick a saved account → the create sends only
    // bankAccountId (no number re-entry) → mock resolves it → burn → payout.
    test("saved-account path: pick saved → Ringkasan (masked) → burn → payout", async ({
      page,
    }) => {
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });

      await page.getByPlaceholder("0", { exact: true }).fill("100");

      // Pick the seeded saved account instead of typing the number.
      await page.getByRole("button", { name: "Saved accounts" }).click();
      await page.getByText("BCA utama").click();

      // Saved path: read-only summary, no Account Number input.
      const form = page.locator("main");
      await expect(form.getByText("Saved account", { exact: true })).toBeVisible();
      await expect(form.getByLabel("Account Number")).toHaveCount(0);

      // Connect → Ringkasan, which shows the resolved masked number + name.
      const redeem = page.getByRole("button", { name: "Redeem", exact: true });
      await redeem.click();
      await redeem.click();
      const dialog = page.getByRole("dialog").filter({ hasText: "Transaction Summary" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/3210/)).toBeVisible();
      await expect(dialog.getByText("SINGGIH BRILIAN TARA")).toBeVisible();

      // Confirm & Burn → tracker reaches payout (mock resolved bankAccountId).
      await page.getByRole("button", { name: "Confirm & Burn" }).click();
      await expect(page.getByText("Payout complete")).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe("negative", () => {
    test("cannot proceed without bank details", async ({ page }) => {
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await expect(page.getByRole("button", { name: "Redeem", exact: true })).toBeDisabled();
    });
  });

  test.describe("edge cases", () => {
    test("sidebar highlights redeem on the redeem page", async ({ page }) => {
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("link", { name: "Redeem", exact: true })).toBeVisible();
    });
  });
});
