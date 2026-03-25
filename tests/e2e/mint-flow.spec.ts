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
  await expect(page.getByText("You will mint")).toBeVisible({
    timeout: 30000,
  });
}

test.describe("Mint Flow", () => {
  test.describe("positive", () => {
    test("complete mint flow: form -> review -> payment -> success", async ({
      page,
    }) => {
      await login(page);

      // Fill mint form
      await page.getByPlaceholder("Amount").first().fill("250");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await page.getByRole("button", { name: "Review Mint" }).click();

      // Verify review panel
      await expect(page.getByText("Mint Detail")).toBeVisible();
      await expect(page.getByText("250 USDX")).toBeVisible();
      await expect(page.getByText("0xabcd...ef12")).toBeVisible();

      // Proceed to payment
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await expect(page.getByText("Payment Gateway")).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("$250", { exact: true }).first()).toBeVisible();

      // Pay
      await page.getByRole("button", { name: /Pay/ }).click();
      await expect(page.getByText("Payment Successful")).toBeVisible({
        timeout: 15000,
      });

      // Go back to mint
      await page.getByRole("button", { name: "Back to Mint" }).click();
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("negative", () => {
    test("cannot proceed with invalid form", async ({ page }) => {
      await login(page);
      await expect(
        page.getByRole("button", { name: "Review Mint" })
      ).toBeDisabled();
    });
  });

  test.describe("edge cases", () => {
    test("can change amount after review", async ({ page }) => {
      await login(page);
      await page.getByPlaceholder("Amount").first().fill("100");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await page.getByRole("button", { name: "Review Mint" }).click();
      await expect(page.getByText("Mint Detail")).toBeVisible();

      // Click Change Amount
      await page.getByRole("button", { name: "Change Amount" }).click();
      // Review panel should disappear
      await expect(page.getByText("Mint Detail")).not.toBeVisible();
    });
  });
});
