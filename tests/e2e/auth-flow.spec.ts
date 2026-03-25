import { test, expect } from "@playwright/test";
import { clearAuth } from "../helpers/playwright-utils";

test.describe("Auth Flow", () => {
  test.describe("positive", () => {
    test("register -> logout -> login -> see dashboard", async ({ page }) => {
      // Clear any existing auth
      await page.goto("/login");
      await clearAuth(page);
      await page.goto("/register");
      await expect(
        page.getByRole("heading", { name: "Create Account" })
      ).toBeVisible({ timeout: 15000 });

      // Register
      await page.getByPlaceholder("Enter your full name").fill("E2E User");
      await page
        .getByPlaceholder("Enter your email")
        .fill("e2e@test.com");
      await page.getByPlaceholder("Create a password").fill("E2eTest12");
      await page
        .getByPlaceholder("Confirm your password")
        .fill("E2eTest12");
      await page.getByRole("button", { name: "Create Account" }).click();

      // Should redirect to mint page
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 30000,
      });

      // Logout via avatar dropdown
      await page.getByRole("button", { name: "EU" }).click();
      await page.getByText("Logout").click();

      // Should be on login page
      await expect(page.getByText("Welcome Back")).toBeVisible({
        timeout: 15000,
      });

      // Login with the same credentials
      await page.getByPlaceholder("Email").fill("e2e@test.com");
      await page.getByPlaceholder("Password").fill("E2eTest12");
      await page.getByRole("button", { name: "Login" }).click();

      // Should see mint page again
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 30000,
      });
    });
  });

  test.describe("negative", () => {
    test("unauthenticated user is redirected to login", async ({ page }) => {
      await page.goto("/login");
      await clearAuth(page);
      await page.goto("/mint");
      await expect(page.getByText("Welcome Back")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("edge cases", () => {
    test("forgot password shows success message", async ({ page }) => {
      await page.goto("/forgot-password");
      await expect(page.getByText("Forgot Password")).toBeVisible({
        timeout: 15000,
      });
      await page
        .getByPlaceholder("Enter your email")
        .fill("demo@usdx.com");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(page.getByText("Check Your Email")).toBeVisible();
    });
  });
});
