import { test, expect } from "@playwright/test";
import { clearAuth } from "../helpers/playwright-utils";

async function gotoLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await expect(page.getByText("Welcome Back")).toBeVisible({ timeout: 15000 });
}

test.describe("Login Page", () => {
  test.describe("positive", () => {
    test("displays login form correctly", async ({ page }) => {
      await gotoLogin(page);
      await expect(page.getByText("Welcome Back")).toBeVisible();
      await expect(page.getByPlaceholder("Email")).toBeVisible();
      await expect(page.getByPlaceholder("Password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    });

    test("logs in with valid credentials and redirects to mint", async ({
      page,
    }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("Email").fill("demo@usdx.com");
      await page.getByPlaceholder("Password").fill("Demo1234");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 30000,
      });
    });

    test("has link to register page", async ({ page }) => {
      await gotoLogin(page);
      const link = page.getByRole("link", {
        name: "Create a Personal Account",
      });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/register");
    });

    test("has link to forgot password", async ({ page }) => {
      await gotoLogin(page);
      const link = page.getByRole("link", { name: "Forgot Password" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/forgot-password");
    });
  });

  test.describe("negative", () => {
    test("shows error for invalid credentials", async ({ page }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("Email").fill("wrong@email.com");
      await page.getByPlaceholder("Password").fill("WrongPass1");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("Invalid email or password")).toBeVisible({
        timeout: 10000,
      });
    });

    test("shows validation error for empty email", async ({ page }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("Password").fill("Demo1234");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("Email is required")).toBeVisible({
        timeout: 10000,
      });
    });

    test("shows validation error for empty password", async ({ page }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("Email").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("Password is required")).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("edge cases", () => {
    test("shows error for email that fails server validation", async ({ page }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("Email").fill("notregistered@test.com");
      await page.getByPlaceholder("Password").fill("WrongPass1");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("Invalid email or password")).toBeVisible({
        timeout: 10000,
      });
    });

    test("Google and Web3 buttons are disabled", async ({ page }) => {
      await gotoLogin(page);
      await expect(
        page.getByRole("button", { name: "Google" })
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Web3 Wallet" })
      ).toBeDisabled();
    });
  });
});
