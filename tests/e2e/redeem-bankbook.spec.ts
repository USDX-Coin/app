import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

// Bank Account Book on the redeem form (USDX-261, reworked USDX-267): selecting a
// saved payout account shows a read-only summary and the redeem create sends
// `bankAccountId` (no number re-entry — resolved server-side from the entry); a just-added
// account auto-fills the manual fields (we hold the plaintext → manual path); dedup
// 409, delete, and manual entry still works (bank book is optional). Mock layer.

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
    test("select a saved account shows a read-only summary (no number re-entry)", async ({ page }) => {
      await openPicker(page);
      // Seeded account (mock): "BCA utama".
      await page.getByText("BCA utama").click();

      const form = page.locator("main");
      // Read-only summary: bank name + full number + holder name + a "Saved account"
      // badge (un-mask 2026-06-25). The Account Number input is gone — never re-typed.
      await expect(form.getByText("Saved account", { exact: true })).toBeVisible();
      await expect(form.getByText("BCA", { exact: true })).toBeVisible();
      await expect(form.getByText(/1234563210/)).toBeVisible();
      await expect(form.getByText("SINGGIH BRILIAN TARA")).toBeVisible();
      await expect(form.getByLabel("Account Number")).toHaveCount(0);

      // "Change" returns to manual entry (clears bankAccountId).
      await form.getByRole("button", { name: "Change" }).click();
      await expect(form.getByLabel("Account Number")).toBeVisible();
    });

    test("add a new account → auto-fills the manual fields (incl. number) + appears in list", async ({ page }) => {
      await openPicker(page);
      await page.getByRole("button", { name: "Add Bank Account" }).click();

      const modal = page.getByRole("dialog", { name: "Add bank account" });
      await modal.getByRole("combobox", { name: "Select bank" }).click();
      await page.getByRole("option", { name: "BCA" }).click();
      await modal.getByLabel("Account Number").fill("9988776655");
      await modal.getByLabel("Holder Name").fill("NEW HOLDER");
      await page.getByPlaceholder("BCA utama").fill("Gaji");
      await modal.getByRole("button", { name: "Add", exact: true }).click();

      // Success toast → the add resolved; modal + picker then close.
      await expect(page.getByText("Bank account added")).toBeVisible({ timeout: 15000 });
      await expect(modal).toBeHidden();

      // Just-added → manual path: the editable fields auto-fill with the plaintext we
      // just typed (no bankAccountId round-trip — only existing saved accounts use it).
      // Scope to the form to avoid the modal's inputs.
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

      const modal = page.getByRole("dialog", { name: "Add bank account" });
      await modal.getByRole("combobox", { name: "Select bank" }).click();
      await page.getByRole("option", { name: "BCA" }).click();
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
      await page.getByRole("combobox", { name: "Select bank" }).click();
      await page.getByText("BCA", { exact: true }).click();
      await page.getByLabel("Account Number").fill("1234563210");
      await page.getByLabel("Holder Name").fill("SINGGIH BRILIAN TARA");

      await expect(page.getByRole("button", { name: "Redeem", exact: true })).toBeEnabled();
    });
  });
});
