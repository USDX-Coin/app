import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";

async function login(page: import("@playwright/test").Page) {
  await forceEnglish(page);
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("you@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("••••••••").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 30000 });
}

test.describe("Mint Flow", () => {
  test.describe("positive", () => {
    test("complete mint flow: form -> Ringkasan modal -> checkout", async ({ page }) => {
      await login(page);

      // Fill mint form
      await page.getByPlaceholder("0", { exact: true }).fill("250");
      await page.getByPlaceholder("Select destination address").fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();

      // Ringkasan (review) modal
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("250 USDX").first()).toBeVisible();
      await expect(page.getByText("0xabcd...ef12")).toBeVisible();

      // Proceed -> creates the order and redirects to the own-hosted checkout
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await page.waitForURL(/\/mint\/checkout\//, { timeout: 15000 });
      await expect(page.getByRole("link", { name: "Back to mint" })).toBeVisible();

      // Back to the mint form
      await page.getByRole("link", { name: "Back to mint" }).click();
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("cannot proceed with invalid form", async ({ page }) => {
      await login(page);
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });
  });

  test.describe("edge cases", () => {
    test("can cancel the Ringkasan modal and change amount", async ({ page }) => {
      await login(page);
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByPlaceholder("Select destination address").fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();

      // Cancel closes the modal, form stays
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByText("Transaction Summary")).not.toBeVisible();
      await expect(page.getByText("You will mint")).toBeVisible();
    });
  });
});
