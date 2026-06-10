import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// /forgot-password (USDX-151 AC: submit → check-email landing). Backend always
// returns a generic 200 (anti-enumeration), so any valid-format email advances.

test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/forgot-password");
  await clearAuth(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible({
    timeout: 10000,
  });
});

test.describe("Forgot Password Page", () => {
  test.describe("positive", () => {
    test("submit advances to the check-email landing", async ({ page }) => {
      await page.getByPlaceholder("Enter your email").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("demo@usdx.com")).toBeVisible();
    });

    test("unknown email still advances (anti-enumeration)", async ({ page }) => {
      await page.getByPlaceholder("Enter your email").fill("nobody@example.com");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("negative", () => {
    test("invalid email format shows inline error", async ({ page }) => {
      // "user@domain" passes the browser's native type=email check (so submit
      // fires) but fails the app's stricter regex (requires a TLD).
      await page.getByPlaceholder("Enter your email").fill("user@domain");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(page.getByText("Invalid email format")).toBeVisible();
    });
  });
});
