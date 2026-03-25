import { test, expect } from "@playwright/test";
import { clearAuth } from "../helpers/playwright-utils";

test.beforeEach(async ({ page }) => {
  await page.goto("/register");
  await clearAuth(page);
  await page.reload();
  await page.waitForSelector("h1", { timeout: 10000 });
});

test.describe("Register Page", () => {
  test.describe("positive", () => {
    test("displays registration form", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "Create Account" })
      ).toBeVisible();
      await expect(
        page.getByPlaceholder("Enter your full name")
      ).toBeVisible();
      await expect(
        page.getByPlaceholder("Enter your email")
      ).toBeVisible();
      await expect(
        page.getByPlaceholder("Create a password")
      ).toBeVisible();
      await expect(
        page.getByPlaceholder("Confirm your password")
      ).toBeVisible();
    });

    test("registers with valid data", async ({ page }) => {
      await page
        .getByPlaceholder("Enter your full name")
        .fill("Test User");
      await page
        .getByPlaceholder("Enter your email")
        .fill("newuser@example.com");
      await page.getByPlaceholder("Create a password").fill("TestPass1");
      await page
        .getByPlaceholder("Confirm your password")
        .fill("TestPass1");
      await page
        .getByRole("button", { name: "Create Account" })
        .click();
      await page.waitForURL("**/mint", { timeout: 10000 });
      await expect(page).toHaveURL(/\/mint/);
    });
  });

  test.describe("negative", () => {
    test("shows error for empty fields", async ({ page }) => {
      await page
        .getByRole("button", { name: "Create Account" })
        .click();
      await expect(page.getByText("Full name is required")).toBeVisible();
      await expect(page.getByText("Email is required")).toBeVisible();
      await expect(page.getByText("Password is required")).toBeVisible();
    });

    test("shows error for password mismatch", async ({ page }) => {
      await page
        .getByPlaceholder("Enter your full name")
        .fill("Test");
      await page
        .getByPlaceholder("Enter your email")
        .fill("t@t.com");
      await page.getByPlaceholder("Create a password").fill("TestPass1");
      await page
        .getByPlaceholder("Confirm your password")
        .fill("Different1");
      await page
        .getByRole("button", { name: "Create Account" })
        .click();
      await expect(
        page.getByText("Passwords do not match")
      ).toBeVisible();
    });

    test("shows error for weak password", async ({ page }) => {
      await page
        .getByPlaceholder("Enter your full name")
        .fill("Test");
      await page
        .getByPlaceholder("Enter your email")
        .fill("t@t.com");
      await page.getByPlaceholder("Create a password").fill("weak");
      await page
        .getByPlaceholder("Confirm your password")
        .fill("weak");
      await page
        .getByRole("button", { name: "Create Account" })
        .click();
      await expect(
        page.getByText("Password must be at least 8 characters")
      ).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("navigates to login page", async ({ page }) => {
      await page.getByRole("link", { name: "Login" }).click();
      await page.waitForURL("**/login", { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
