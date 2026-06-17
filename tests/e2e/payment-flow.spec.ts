import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";

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
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 30000 });
}

// USDX-202: full own-hosted checkout. After the Ringkasan modal creates the
// order (POST /v2/mint) and redirects to /mint/checkout/{id}, the user picks a
// payment method (VA needs a bank), pays (POST /pay), sees inline instructions,
// and the status tracker advances to COMPLETED (mock auto-advances).
test.describe("Payment Flow", () => {
  test.describe("positive", () => {
    test("mint -> checkout -> pick VA + bank -> pay -> instructions + tracker completes", async ({
      page,
    }) => {
      await login(page);

      // Fill mint form
      await page.getByPlaceholder("0", { exact: true }).fill("500");
      await page
        .getByPlaceholder("Select destination address")
        .fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("500 USDX").first()).toBeVisible();

      // Proceed payment -> order created -> redirected to the checkout page
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await page.waitForURL(/\/mint\/checkout\//, { timeout: 15000 });
      await expect(page.getByText(/#USDX-/)).toBeVisible();

      // Choose VA — "Pay" stays disabled until a bank is selected
      await page.getByText("Virtual Account").click();
      await expect(page.getByRole("button", { name: "Pay", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "BCA", exact: true }).click();
      await page.getByRole("button", { name: "Pay", exact: true }).click();

      // Inline VA instructions + status tracker advancing to COMPLETED (mock)
      await expect(page.getByText("Payment instructions")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("link", { name: "View history" })).toBeVisible({
        timeout: 30000,
      });
    });
  });

  test.describe("edge cases", () => {
    test("payment page redirects to mint when accessed directly", async ({
      page,
    }) => {
      await login(page);
      // Navigate directly to the legacy payment page without mint data
      await page.goto("/payment");
      // Should redirect to /mint since no amount data
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 15000,
      });
    });
  });
});
