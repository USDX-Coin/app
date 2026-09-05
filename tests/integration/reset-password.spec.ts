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
      await page.getByPlaceholder("Type the new password again").fill("NewPass123");
      await page.getByRole("button", { name: "Save the new password" }).click();
      await page.waitForURL(/\/mint/, { timeout: 30000 });
    });

    test("renders default reset copy when type param is absent", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token");
      await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Save the new password" })).toBeVisible();
    });
  });

  test.describe("negative", () => {
    // Was: "expired token shows an error toast". A toast over a form that is
    // still fillable and still submittable is what made people re-click the same
    // dead mail; Figma 36 replaces the form with the dead-link screen, which
    // carries the only action that works. Same fact under test — the app refuses
    // a rejected token and says so — asserted on the screen that replaced it.
    test("server-rejected token replaces the form with the dead-link screen", async ({
      page,
    }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=expired-token");
      await page.getByPlaceholder("Create a new password").fill("NewPass123");
      await page.getByPlaceholder("Type the new password again").fill("NewPass123");
      await page.getByRole("button", { name: "Save the new password" }).click();

      await expect(
        page.getByRole("heading", { name: "This link no longer works" })
      ).toBeVisible({ timeout: 10000 });
      // The form is gone, so the dead link cannot be submitted a second time.
      await expect(page.getByPlaceholder("Create a new password")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Request a new link" })
      ).toHaveAttribute("href", "/forgot-password");
    });

    // Was: "missing token shows an error toast on submit" — two password fields
    // had to be filled in before the app admitted the link was unusable. It can
    // tell from the URL alone, so it now says so before anything is typed.
    test("missing token renders the dead-link screen instead of a form", async ({
      page,
    }) => {
      await forceEnglish(page);
      await gotoReset(page, "");
      await expect(
        page.getByRole("heading", { name: "This link no longer works" })
      ).toBeVisible({ timeout: 10000 });
      await expect(page.getByPlaceholder("Create a new password")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Save the new password" })
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Request a new link" })
      ).toHaveAttribute("href", "/forgot-password");
    });

    test("password mismatch shows inline error", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token");
      await page.getByPlaceholder("Create a new password").fill("NewPass123");
      await page.getByPlaceholder("Type the new password again").fill("Different1");
      await page.getByRole("button", { name: "Save the new password" }).click();
      await expect(page.getByText("The two passwords are not the same")).toBeVisible();
    });
  });

  test.describe("edge cases — adaptive copy (USDX-142)", () => {
    test("type=activation renders invite copy (default locale: Atur kata sandi)", async ({
      page,
    }) => {
      // No forceEnglish — default Indonesian locale, per the SOT copy example.
      await gotoReset(page, "token=valid-token&type=activation");
      await expect(page.getByRole("heading", { name: "Atur kata sandi" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Aktifkan akun" })).toBeVisible();
    });

    test("type=activation renders invite copy in English", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token&type=activation");
      await expect(page.getByRole("heading", { name: "Set Your Password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Activate account" })).toBeVisible();
    });

    test("unknown type value falls back to reset copy", async ({ page }) => {
      await forceEnglish(page);
      await gotoReset(page, "token=valid-token&type=xyz");
      await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Save the new password" })).toBeVisible();
    });
  });
});
