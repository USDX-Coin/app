import { test, expect, type Page } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// A fresh address not in the seeded mock book (mock-api SEEDED entries).
const NEW_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
// One of the seeded entries — adding it again must 409 (USDX-203 AC: duplicate).
const SEEDED_ADDRESS = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

async function login(page: Page) {
  await forceEnglish(page);
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("Enter your password").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 30000 });
}

// Mint form "Add address book" link → picker → "Add wallet" → the Add Wallet modal.
async function openAddWalletModal(page: Page) {
  await page.getByRole("button", { name: "Add address book" }).click();
  await expect(page.getByRole("heading", { name: "Address book" })).toBeVisible();
  await page.getByRole("button", { name: "Add wallet" }).click();
  await expect(page.getByRole("heading", { name: "Add Wallet", exact: true })).toBeVisible();
}

test.describe("Address Book — Add Wallet", () => {
  test.describe("positive", () => {
    test("add succeeds → entry appears in the list and is selected in 'To'", async ({ page }) => {
      await login(page);
      await openAddWalletModal(page);

      await page.getByLabel("Wallet Address").fill(NEW_ADDRESS);
      await page.getByLabel("Label", { exact: true }).fill("My Friend");
      await page.getByRole("button", { name: "Add", exact: true }).click();

      // Modal + picker close; the new address lands in the "To" field.
      await expect(page.getByRole("heading", { name: "Add Wallet", exact: true })).not.toBeVisible();
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toHaveValue(NEW_ADDRESS);

      // Reopen the picker → the new entry is in the list.
      await page.getByRole("button", { name: "Add address book" }).click();
      await expect(page.getByText("My Friend")).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("invalid address keeps the Add button disabled", async ({ page }) => {
      await login(page);
      await openAddWalletModal(page);

      await page.getByLabel("Wallet Address").fill("0x123");
      await page.getByLabel("Label", { exact: true }).fill("Bad");
      await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
    });

    test("duplicate address shows the 409 error", async ({ page }) => {
      await login(page);
      await openAddWalletModal(page);

      await page.getByLabel("Wallet Address").fill(SEEDED_ADDRESS);
      await page.getByLabel("Label", { exact: true }).fill("Dup");
      await page.getByRole("button", { name: "Add", exact: true }).click();

      await expect(page.getByText("This address is already in your address book.")).toBeVisible();
      // Modal stays open on error.
      await expect(page.getByRole("heading", { name: "Add Wallet", exact: true })).toBeVisible();
    });
  });
});
