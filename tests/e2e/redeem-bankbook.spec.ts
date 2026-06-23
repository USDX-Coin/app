import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

// Bank Account Book on the redeem form (USDX-261): select a saved payout account
// (autofills bank + holder name; the number is re-entered since only masked is
// returned — Option B), add a new account (full autofill incl. number), dedup 409,
// delete, and manual entry still works (bank book is optional). Mock layer.

test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await page.goto("/redeem");
  await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
});

async function openPicker(page: Page) {
  await page.getByRole("button", { name: "Saved accounts" }).click();
  await expect(page.getByText("Saved bank accounts")).toBeVisible();
}

test.describe("Redeem Bank Account Book", () => {
  test.describe("positive", () => {
    test("select a saved account autofills bank + holder name (number re-entered)", async ({ page }) => {
      await openPicker(page);
      // Seeded account (mock): "BCA utama".
      await page.getByText("BCA utama").click();

      // Bank + holder name autofilled; number left for manual entry with a hint.
      await expect(page.getByRole("button", { name: "Select bank" })).toContainText("BCA");
      await expect(page.getByLabel("Holder Name")).toHaveValue("SINGGIH BRILIAN TARA");
      await expect(page.getByLabel("Account Number")).toHaveValue("");
      await expect(page.getByText(/enter the full number to confirm/)).toBeVisible();
    });

    test("add a new account → full autofill (incl. number) + appears in list", async ({ page }) => {
      await openPicker(page);
      await page.getByRole("button", { name: "Add Bank Account" }).click();

      const modal = page.getByRole("dialog", { name: "Add Bank Account" });
      await modal.getByRole("button", { name: "Select bank" }).click();
      await modal.getByText("BCA", { exact: true }).click();
      await modal.getByLabel("Account Number").fill("9988776655");
      await modal.getByLabel("Holder Name").fill("NEW HOLDER");
      await page.getByPlaceholder("BCA utama").fill("Gaji");
      await modal.getByRole("button", { name: "Add", exact: true }).click();

      // Success toast → the add resolved; modal + picker then close.
      await expect(page.getByText("Bank account added")).toBeVisible({ timeout: 15000 });
      await expect(modal).toBeHidden();

      // The new account is applied to the form fully (number too — we have the
      // plaintext at add time). Scope to the form to avoid the modal's inputs.
      const form = page.locator("main");
      await expect(form.getByLabel("Holder Name")).toHaveValue("NEW HOLDER");
      await expect(form.getByLabel("Account Number")).toHaveValue("9988776655");

      // Reopen the picker → the new account is listed.
      await openPicker(page);
      await expect(page.getByText("Gaji")).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("duplicate account → 409 inline error", async ({ page }) => {
      await openPicker(page);
      await page.getByRole("button", { name: "Add Bank Account" }).click();

      const modal = page.getByRole("dialog", { name: "Add Bank Account" });
      await modal.getByRole("button", { name: "Select bank" }).click();
      await modal.getByText("BCA", { exact: true }).click();
      // Matches seeded BCA account 1234563210 → duplicate.
      await modal.getByLabel("Account Number").fill("1234563210");
      await modal.getByLabel("Holder Name").fill("SINGGIH BRILIAN TARA");
      await modal.getByRole("button", { name: "Add", exact: true }).click();

      await expect(page.getByText("This bank account is already saved.")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("delete a saved account removes it from the list", async ({ page }) => {
      await openPicker(page);
      await expect(page.getByText("BCA utama")).toBeVisible();

      // Two-step inline confirm (Trash → Check).
      await page.getByRole("button", { name: "Delete entry" }).first().click();
      await page.getByRole("button", { name: "Delete entry" }).first().click();

      await expect(page.getByText("BCA utama")).toHaveCount(0);
    });

    test("manual bank entry still works without the saved book", async ({ page }) => {
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByRole("button", { name: "Select bank" }).click();
      await page.getByText("BCA", { exact: true }).click();
      await page.getByLabel("Account Number").fill("1234563210");
      await page.getByLabel("Holder Name").fill("SINGGIH BRILIAN TARA");

      await expect(page.getByRole("button", { name: "Redeem", exact: true })).toBeEnabled();
    });
  });
});
