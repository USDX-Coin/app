import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

async function login(page: import("@playwright/test").Page) {
  await forceEnglish(page);
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("you@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("••••••••").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("You will mint")).toBeVisible({
    timeout: 30000,
  });
}

// Redeem no longer requires a wallet connection — it redeems to a saved bank
// account: form (amount + bank) -> confirmation -> status.
test.describe("Redeem Flow", () => {
  test.describe("positive", () => {
    test("complete redeem flow: form -> confirmation -> status", async ({
      page,
    }) => {
      await login(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({
        timeout: 15000,
      });

      // Fill amount and pick a bank account
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByText("Select bank account").click();
      await page.getByText("Chase", { exact: true }).click();

      await page.getByRole("button", { name: "Redeem", exact: true }).click();

      // Confirmation step
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("100 USDX")).toBeVisible();
      await expect(page.getByText(/Chase/)).toBeVisible();

      // Confirm -> status step
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByText("Redeem Request Submitted")).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByRole("button", { name: "Back to Redeem" })
      ).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("cannot redeem without selecting a bank account", async ({ page }) => {
      await login(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({
        timeout: 15000,
      });
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      // No bank account selected -> Redeem stays disabled
      await expect(
        page.getByRole("button", { name: "Redeem", exact: true })
      ).toBeDisabled();
    });
  });

  test.describe("edge cases", () => {
    test("sidebar highlights redeem when on redeem page", async ({ page }) => {
      await login(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByRole("link", { name: "Redeem", exact: true })
      ).toBeVisible();
    });
  });
});
