import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

test.describe("Auth Flow", () => {
  test.describe("positive", () => {
    test("register -> check email -> login -> dashboard -> logout", async ({
      page,
    }) => {
      // Clear any existing auth
      await forceEnglish(page);
      await page.goto("/login");
      await clearAuth(page);
      await page.goto("/register");
      await expect(
        page.getByRole("heading", { name: "Create an account" })
      ).toBeVisible({ timeout: 15000 });

      // Register (new contract: email, phone, password x2, ToS — no fullName)
      await page
        .getByPlaceholder("Enter your email")
        .fill(`e2e-${Date.now()}@test.com`);
      await page.getByPlaceholder("08xx or +62xx").fill("081234567891");
      await page.getByPlaceholder("Create a password").fill("E2eTest12");
      await page.getByPlaceholder("Type the password again").fill("E2eTest12");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Create account" }).click();

      // Register no longer auto-logs in — it lands on the check-email page
      await page.waitForURL(/\/register\/check-email/, { timeout: 30000 });
      await expect(
        page.getByRole("heading", { name: "Check your email" })
      ).toBeVisible();

      // Login with the verified demo account (fresh accounts need email verification)
      await page.goto("/login");
      await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
      await page.getByPlaceholder("Enter your password").fill("Demo1234");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 30000,
      });

      // Logout via the sidebar account menu — with the confirm step (PR 2, F.4).
      // Matched on the signed-in identity, not a generic label: the button
      // carries no aria-label, so its accessible name is the name + email it
      // shows (WCAG 2.5.3).
      await page.getByRole("button", { name: /demo@usdx\.com/ }).click();
      await page.getByRole("menuitem", { name: "Log out" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Log out" })
        .click();

      // Should be back on the login page
      await expect(
        page.getByRole("heading", { name: "Welcome back" })
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("unauthenticated user is redirected to login", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/login");
      await clearAuth(page);
      await page.goto("/mint");
      await expect(
        page.getByRole("heading", { name: "Welcome back" })
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("edge cases", () => {
    test("forgot password shows success message", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/forgot-password");
      await expect(
        page.getByRole("heading", { name: "Forgot your password?" })
      ).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({
        timeout: 10000,
      });
    });
  });
});
