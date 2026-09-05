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
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
      await expect(page.getByText("someone@example.com")).toBeVisible();
    });

    test("resend button disables with a 60s countdown after click", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await clearAuth(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await page.getByRole("button", { name: "Resend the link" }).click();
      const cooldownButton = page.getByRole("button", { name: /Resend in \d+s/ });
      await expect(cooldownButton).toBeVisible({ timeout: 10000 });
      await expect(cooldownButton).toBeDisabled();
    });

    test("short cooldown keeps ticking once per second (USDX-167, ID locale)", async ({
      page,
    }) => {
      // Default locale is Indonesian — no forceEnglish.
      await page.goto("/register/check-email?email=someone%40example.com");
      await clearAuth(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await page.getByRole("button", { name: "Kirim ulang tautan" }).click();
      // Starts at 60 (one tick of slack for slow CI), then proves the
      // per-second tick by waiting for a strictly lower remaining count.
      await expect(
        page.getByRole("button", { name: /Kirim ulang dalam (60|59) detik/ })
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("button", { name: /Kirim ulang dalam 5[5-8] detik/ })
      ).toBeVisible({ timeout: 6000 });
      await expect(
        page.getByRole("button", { name: /Kirim ulang dalam \d+ detik/ })
      ).toBeDisabled();
    });

    // Figma 33 · Cek email, blok E. The three lines used to be missing entirely;
    // they are the whole answer to "the mail has not arrived", so their absence
    // is what sent people back to Register to try a second address.
    test("help box lists what to do when the mail has not arrived", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await clearAuth(page);
      await page.goto("/register/check-email?email=someone%40example.com");
      await expect(page.getByText("Email has not arrived?")).toBeVisible();
      await expect(page.getByText("Check the spam or promotions folder.")).toBeVisible();
      await expect(
        page.getByText("Wait 1–2 minutes — delivery is sometimes delayed.")
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Register again" })
      ).toHaveAttribute("href", "/register");
    });
  });

  test.describe("edge cases", () => {
    // Was: "missing email shows an error toast on resend". The page has no
    // address to resend to when it is opened without ?email= (direct hit, or a
    // refresh that dropped the query), so Figma 33 (state "tanpa alamat")
    // replaced the resend button with the action that CAN work. The old spec
    // locked in a button whose only outcome was a failure toast; this one
    // asserts the same situation is still handled, on the screen that replaced it.
    test("without ?email= the resend button is replaced by Register again", async ({
      page,
    }) => {
      await forceEnglish(page);
      await page.goto("/register/check-email");
      await clearAuth(page);
      await page.goto("/register/check-email");

      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Resend the link" })).toHaveCount(0);
      // The address is unknown, so the sentence must not pretend to name one.
      await expect(
        page.getByText("We sent an activation link to the address you registered")
      ).toBeVisible();

      const registerAgain = page.getByRole("link", { name: "Register again" });
      await expect(registerAgain).toBeVisible();
      await registerAgain.click();
      await page.waitForURL(/\/register$/, { timeout: 10000 });
    });
  });
});
