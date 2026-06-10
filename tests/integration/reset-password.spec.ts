import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// /reset-password (USDX-151). Accepts both forgot-password and admin-created
// activation links; copy adapts via the `type` query param (PM decision USDX-142):
// `type=activation` → invite copy; absent or unknown → default reset copy.
// Default locale is Indonesian — English assertions call forceEnglish first.

async function gotoReset(page: import("@playwright/test").Page, query: string) {
  await page.goto(`/reset-password?${query}`);
  await clearAuth(page);
  await page.goto(`/reset-password?${query}`);
}

test.describe("Reset Password Page", () => {
  test.describe("positive", () => {
    test("valid token sets new password and auto-logs in to mint", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token");
      await page.getByPlaceholder("Create a new password").fill("NewPass123");
      await page.getByPlaceholder("Confirm your new password").fill("NewPass123");
      await page.getByRole("button", { name: "Reset Password" }).click();
      await page.waitForURL(/\/mint/, { timeout: 30000 });
    });

    test("renders default reset copy when type param is absent", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token");
      await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Reset Password" })).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("expired token shows an error toast", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=expired-token");
      await page.getByPlaceholder("Create a new password").fill("NewPass123");
      await page.getByPlaceholder("Confirm your new password").fill("NewPass123");
      await page.getByRole("button", { name: "Reset Password" }).click();
      await expect(page.getByText("This link is invalid or has expired")).toBeVisible({
        timeout: 10000,
      });
    });

    test("missing token shows an error toast on submit", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "");
      await page.getByPlaceholder("Create a new password").fill("NewPass123");
      await page.getByPlaceholder("Confirm your new password").fill("NewPass123");
      await page.getByRole("button", { name: "Reset Password" }).click();
      await expect(page.getByText("This reset link is missing its token.")).toBeVisible({
        timeout: 10000,
      });
    });

    test("password mismatch shows inline error", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token");
      await page.getByPlaceholder("Create a new password").fill("NewPass123");
      await page.getByPlaceholder("Confirm your new password").fill("Different1");
      await page.getByRole("button", { name: "Reset Password" }).click();
      await expect(page.getByText("Passwords do not match")).toBeVisible();
    });
  });

  test.describe("edge cases — adaptive copy (USDX-142)", () => {
    test("type=activation renders invite copy (default locale: Atur Password)", async ({
      page,
    }) => {
      // No forceEnglish — default Indonesian locale, per the SOT copy example.
      await gotoReset(page, "token=valid-token&type=activation");
      await expect(page.getByRole("heading", { name: "Atur Password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Atur Password" })).toBeVisible();
    });

    test("type=activation renders invite copy in English", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token&type=activation");
      await expect(page.getByRole("heading", { name: "Set Your Password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Set Password" })).toBeVisible();
    });

    test("unknown type value falls back to reset copy", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token&type=xyz");
      await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Reset Password" })).toBeVisible();
    });
  });
});
