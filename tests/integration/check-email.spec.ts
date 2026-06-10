import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// /register/check-email (USDX-151): landing after register, with a resend button
// that goes into a 60s disabled countdown after a successful resend.

test.describe("Check Email Page", () => {
  test.describe("positive", () => {
    test("shows the registered email address", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await clearAuth(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await expect(page.getByRole("heading", { name: "Verify Your Email" })).toBeVisible();
      await expect(page.getByText("someone@example.com")).toBeVisible();
    });

    test("resend button disables with a 60s countdown after click", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await clearAuth(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await page.getByRole("button", { name: "Resend Verification" }).click();
      const cooldownButton = page.getByRole("button", { name: /Resend in \d+s/ });
      await expect(cooldownButton).toBeVisible({ timeout: 10000 });
      await expect(cooldownButton).toBeDisabled();
    });
  });

  test.describe("edge cases", () => {
    test("missing email shows an error toast on resend", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/register/check-email");
      await clearAuth(page);
      await page.goto("/register/check-email");
      await page.getByRole("button", { name: "Resend Verification" }).click();
      await expect(
        page.getByText("Missing email address — please register again.")
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
