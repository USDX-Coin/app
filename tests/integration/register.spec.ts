import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// Register contract (USDX-150): email, phone, password, confirmPassword,
// entityType INDIVIDUAL + ToS checkbox. fullName was removed (collected at KYC).
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/register");
  await clearAuth(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Create an account" })
  ).toBeVisible({ timeout: 10000 });
});

test.describe("Register Page", () => {
  test.describe("positive", () => {
    test("displays registration form", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "Create an account" })
      ).toBeVisible();
      await expect(page.getByPlaceholder("Enter your email")).toBeVisible();
      await expect(page.getByPlaceholder("08xx or +62xx")).toBeVisible();
      await expect(page.getByPlaceholder("Create a password")).toBeVisible();
      await expect(
        page.getByPlaceholder("Type the password again")
      ).toBeVisible();
      await expect(page.getByRole("checkbox")).toBeVisible();
    });

    // Account type moved from two outline buttons to Card/Pilihan (Figma 32):
    // it is a single choice out of two, so it is a radio group, and each card has
    // room for the line that explains it. The "SEGERA HADIR" pill is deliberately
    // NOT rendered here — at 218 px (two cards side by side) it leaves ~35 px for
    // the title and truncates it, so the description carries the same fact.
    test("account type is a radio group with Legal Entity disabled as coming soon", async ({
      page,
    }) => {
      const individual = page.getByRole("radio", { name: /Individual/ });
      await expect(individual).toBeVisible();
      await expect(individual).toBeChecked();

      const legalEntity = page.getByRole("radio", { name: /Legal Entity/ });
      await expect(legalEntity).toBeDisabled();
      await expect(legalEntity).not.toBeChecked();
      // The reason it is dead is on the card, not hidden in a tooltip.
      await expect(
        page.locator("[data-slot=card-choice]").filter({ hasText: "Legal Entity" })
      ).toContainText("Coming soon");
    });

    test("registers with valid data and lands on check-email", async ({
      page,
    }) => {
      await page
        .getByPlaceholder("Enter your email")
        .fill(`newuser-${Date.now()}@example.com`);
      await page.getByPlaceholder("08xx or +62xx").fill("081234567890");
      await page.getByPlaceholder("Create a password").fill("TestPass1");
      await page
        .getByPlaceholder("Type the password again")
        .fill("TestPass1");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Create account" }).click();
      // Register no longer auto-logs in — it routes to the check-email page.
      await page.waitForURL(/\/register\/check-email/, { timeout: 10000 });
      await expect(
        page.getByRole("heading", { name: "Check your email" })
      ).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("shows error for empty fields", async ({ page }) => {
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByText("Email is required")).toBeVisible();
      await expect(page.getByText("Phone number is required")).toBeVisible();
      await expect(page.getByText("Password is required")).toBeVisible();
      await expect(
        page.getByText("You must accept the Terms of Service")
      ).toBeVisible();
    });

    test("shows error for password mismatch", async ({ page }) => {
      await page.getByPlaceholder("Enter your email").fill("t@t.com");
      await page.getByPlaceholder("08xx or +62xx").fill("081234567890");
      await page.getByPlaceholder("Create a password").fill("TestPass1");
      await page
        .getByPlaceholder("Type the password again")
        .fill("Different1");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByText("The two passwords are not the same")).toBeVisible();
    });

    test("duplicate email shows inline 409 error on the email field", async ({
      page,
    }) => {
      await page.getByPlaceholder("Enter your email").fill("demo@usdx.com");
      await page.getByPlaceholder("08xx or +62xx").fill("089876543210");
      await page.getByPlaceholder("Create a password").fill("TestPass1");
      await page.getByPlaceholder("Type the password again").fill("TestPass1");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByText("This email is already registered")).toBeVisible({
        timeout: 10000,
      });
      // Still on the register page — inline error, not a redirect.
      await expect(page).toHaveURL(/\/register$/);
    });

    test("duplicate phone shows inline 409 error on the phone field", async ({
      page,
    }) => {
      await page
        .getByPlaceholder("Enter your email")
        .fill(`unique-${Date.now()}@example.com`);
      // 08123456789 normalizes to +628123456789 — the demo account's phone.
      await page.getByPlaceholder("08xx or +62xx").fill("08123456789");
      await page.getByPlaceholder("Create a password").fill("TestPass1");
      await page.getByPlaceholder("Type the password again").fill("TestPass1");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(
        page.getByText("This phone number is already registered")
      ).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/\/register$/);
    });

    test("shows error for weak password", async ({ page }) => {
      await page.getByPlaceholder("Enter your email").fill("t@t.com");
      await page.getByPlaceholder("08xx or +62xx").fill("081234567890");
      await page.getByPlaceholder("Create a password").fill("weak");
      await page.getByPlaceholder("Type the password again").fill("weak");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(
        page.getByText("Use at least 8 characters")
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
