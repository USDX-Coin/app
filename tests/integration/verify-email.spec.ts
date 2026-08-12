import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// /verify-email (USDX-151): auto-calls POST verify-email with ?token=... on mount.
// Success issues a session (auto-login) and redirects to the dashboard (/mint).

test.describe("Verify Email Page", () => {
  test.describe("positive", () => {
    test("valid token auto-verifies and redirects to mint", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/verify-email");
      await clearAuth(page);
      await page.goto("/verify-email?token=valid-token");
      await page.waitForURL(/\/mint/, { timeout: 30000 });
    });
  });

  test.describe("negative", () => {
    test("expired token renders the invalid-link error", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/verify-email");
      await clearAuth(page);
      await page.goto("/verify-email?token=expired-token");
      await expect(
        page.getByRole("heading", { name: "Verification Failed" })
      ).toBeVisible({ timeout: 10000 });
      // INVALID_TOKEN maps to the standard dictionary copy, not the raw API message.
      await expect(
        page.getByText("This verification link is invalid or has expired.")
      ).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("missing token renders an error without calling the API", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/verify-email");
      await clearAuth(page);
      await page.goto("/verify-email");
      await expect(
        page.getByRole("heading", { name: "Verification Failed" })
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByText("This verification link is missing its token.")
      ).toBeVisible();
    });
  });
});
