import { test, expect } from "@playwright/test";
import { clearAuth } from "../helpers/playwright-utils";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await expect(page.getByText("Welcome Back")).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("Email").fill("demo@usdx.com");
  await page.getByPlaceholder("Password").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 30000 });
}

test.describe("Payment Flow", () => {
  test.describe("positive", () => {
    test("mint -> review -> payment -> success -> back to mint", async ({
      page,
    }) => {
      await login(page);

      // Fill mint form
      await page.getByPlaceholder("Amount").first().fill("500");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await page.getByRole("button", { name: "Review Mint" }).click();
      await expect(page.getByText("Mint Detail")).toBeVisible();

      // Proceed to payment
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await expect(page.getByText("Payment Gateway")).toBeVisible({
        timeout: 15000,
      });

      // Verify payment shows correct amount
      await expect(page.getByText("500 USDX")).toBeVisible();

      // Complete payment
      await page.getByRole("button", { name: /Pay/ }).click();
      await expect(page.getByText("Payment Successful")).toBeVisible({
        timeout: 15000,
      });

      // Return to mint
      await page.getByRole("button", { name: "Back to Mint" }).click();
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("edge cases", () => {
    test("payment page redirects to mint when accessed directly", async ({
      page,
    }) => {
      await login(page);
      // Navigate directly to payment without going through mint review
      await page.goto("/payment");
      // Should redirect to /mint since no amount data
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 15000,
      });
    });
  });
});
