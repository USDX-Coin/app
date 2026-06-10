import { test, expect, type Page } from "@playwright/test";
import { clearAuth, forceEnglish } from "../../helpers/playwright-utils";

// USDX-151 AC: semua form auth responsive (1440 + 375) + keyboard nav + aria label.
// 1440 shows the branding panel (lg:flex); 375 hides it and keeps the form usable.

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 667 };

async function gotoClean(page: Page, path: string) {
  await forceEnglish(page);
  await page.goto(path);
  await clearAuth(page);
  await page.goto(path);
}

test.describe("Auth Responsive (1440)", () => {
  test.use({ viewport: DESKTOP });

  test("login shows branding panel and form side by side", async ({ page }) => {
    await gotoClean(page, "/login");
    await expect(
      page.getByRole("heading", { name: "The Transparent & Regulated USD Stablecoin" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("register form is fully visible", async ({ page }) => {
    await gotoClean(page, "/register");
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Individual" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
  });

  test("reset-password form is fully visible", async ({ page }) => {
    await gotoClean(page, "/reset-password?token=valid-token");
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset Password" })).toBeVisible();
  });
});

test.describe("Auth Responsive (375)", () => {
  test.use({ viewport: MOBILE });

  test("login hides branding panel but keeps the form usable", async ({ page }) => {
    await gotoClean(page, "/login");
    await expect(
      page.getByRole("heading", { name: "The Transparent & Regulated USD Stablecoin" })
    ).toBeHidden();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByPlaceholder("you@email.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("register form is usable on mobile", async ({ page }) => {
    await gotoClean(page, "/register");
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
    await expect(page.getByPlaceholder("08xx or +62xx")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
  });

  test("reset-password form is usable on mobile", async ({ page }) => {
    await gotoClean(page, "/reset-password?token=valid-token&type=activation");
    await expect(page.getByRole("heading", { name: "Set Your Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Set Password" })).toBeVisible();
  });
});

test.describe("Auth Accessibility", () => {
  test("login is navigable by keyboard and submits via Enter", async ({ page }) => {
    await gotoClean(page, "/login");
    await page.getByPlaceholder("you@email.com").focus();
    await page.keyboard.type("demo@usdx.com");
    await page.keyboard.press("Tab"); // → forgot-password link
    await page.keyboard.press("Tab"); // → password input
    await page.keyboard.type("Demo1234");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/mint/, { timeout: 30000 });
  });

  test("password visibility toggles carry aria labels", async ({ page }) => {
    await gotoClean(page, "/login");
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
  });

  test("inputs are labeled (getByLabel resolves)", async ({ page }) => {
    await gotoClean(page, "/login");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });
});
