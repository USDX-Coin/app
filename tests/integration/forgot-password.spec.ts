import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish, seedRetryAfter } from "../helpers/playwright-utils";

// /forgot-password (USDX-151 AC: submit → check-email landing). Backend always
// returns a generic 200 (anti-enumeration), so any valid-format email advances.

test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/forgot-password");
  await clearAuth(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible({
    timeout: 10000,
  });
});

test.describe("Forgot Password Page", () => {
  test.describe("positive", () => {
    test("submit advances to the check-email landing", async ({ page }) => {
      await page.getByPlaceholder("Enter your email").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("demo@usdx.com")).toBeVisible();
    });

    test("unknown email still advances (anti-enumeration)", async ({ page }) => {
      await page.getByPlaceholder("Enter your email").fill("nobody@example.com");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("negative", () => {
    test("invalid email format shows inline error", async ({ page }) => {
      // "user@domain" passes the browser's native type=email check (so submit
      // fires) but fails the app's stricter regex (requires a TLD).
      await page.getByPlaceholder("Enter your email").fill("user@domain");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(page.getByText("Enter a valid email address")).toBeVisible();
    });
  });

  // 429 cooldowns render a human-readable duration, never the raw Retry-After
  // seconds (USDX-167). The seam arms the mock's next response; daily limits
  // (forgot password 3x/hari → ~22h, sot/conventions.md § Rate Limiting) are
  // unreachable organically in the per-page-load mock.
  test.describe("rate limited (USDX-167)", () => {
    test("daily-limit wait renders as hours in Indonesian, no raw seconds", async ({
      page,
    }) => {
      await seedRetryAfter(page, 76451); // 21h14m until the daily window resets
      await page.addInitScript(() => localStorage.setItem("usdx-lang", "id"));
      await page.reload();
      await page.getByPlaceholder("nama@email.com").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Kirim tautan" }).click();
      const cooldownButton = page.getByRole("button", {
        name: "Coba lagi dalam sekitar 22 jam",
      });
      await expect(cooldownButton).toBeVisible({ timeout: 10000 });
      await expect(cooldownButton).toBeDisabled();
      await expect(page.getByText("76451")).not.toBeVisible();
    });

    test("five-minute wait renders as minutes in Indonesian", async ({ page }) => {
      await seedRetryAfter(page, 300);
      await page.addInitScript(() => localStorage.setItem("usdx-lang", "id"));
      await page.reload();
      await page.getByPlaceholder("nama@email.com").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Kirim tautan" }).click();
      await expect(
        page.getByRole("button", { name: "Coba lagi dalam 5 menit" })
      ).toBeVisible({ timeout: 10000 });
    });

    test("English locale renders English units", async ({ page }) => {
      await seedRetryAfter(page, 76451);
      await page.reload(); // beforeEach already forced English
      await page.getByPlaceholder("Enter your email").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(
        page.getByRole("button", { name: "Try again in about 22 hours" })
      ).toBeVisible({ timeout: 10000 });
    });

    test("missing Retry-After falls back to the default 60s cooldown", async ({
      page,
    }) => {
      await seedRetryAfter(page, 0);
      await page.reload();
      await page.getByPlaceholder("Enter your email").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Send Reset Link" }).click();
      await expect(
        page.getByRole("button", { name: /Try again in (60|59)s/ })
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
