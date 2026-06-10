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

// The redesign replaced the standalone /payment gateway hop with the in-page
// confirmation -> status steps ("Proceed Payment" submits the mint order).
test.describe("Payment Flow", () => {
  test.describe("positive", () => {
    test("mint -> confirmation -> proceed payment -> status -> view history", async ({
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

      // Proceed payment -> order submitted
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await expect(page.getByText("Mint Request Submitted")).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText(/#MINT_/)).toBeVisible();

      // Jump to transaction history
      await page.getByRole("button", { name: "View History" }).click();
      await expect(page.getByText("Transaction History")).toBeVisible({
        timeout: 15000,
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
