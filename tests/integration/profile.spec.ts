import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
} from "../helpers/playwright-utils";

test.describe("Profile Page", () => {
  test.describe("positive", () => {
    test.beforeEach(async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/profile");
      await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({
        timeout: 15000,
      });
    });

    test("displays user info", async ({ page }) => {
      // Name also appears in the sidebar account switcher — assert the first match.
      await expect(page.getByText("Demo User").first()).toBeVisible();
      await expect(page.getByText("demo@usdx.com")).toBeVisible();
    });

    test("shows verification badge", async ({ page }) => {
      await expect(page.getByText("Verified", { exact: true }).first()).toBeVisible();
    });

    test("renders all chrome strings in English", async ({ page }) => {
      await expect(page.getByText("Personal Information")).toBeVisible();
      await expect(page.getByText("Full Name")).toBeVisible();
      await expect(page.getByText("Email", { exact: true })).toBeVisible();
      await expect(page.getByText("Member Since")).toBeVisible();
      await expect(page.getByText("Verification Status")).toBeVisible();
      await expect(page.getByText("Security")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("shows member since date in formal format", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/profile");
      await expect(page.getByText("Member Since")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("January 1, 2026")).toBeVisible();
    });

    // Scope: Personal Information + Security. The Preferences section is
    // intentionally left English here — its cleanup + i18n is USDX-177.
    test("renders Personal Information + Security in Indonesian", async ({
      page,
    }) => {
      await forceIndonesian(page);
      await loginViaStorage(page);
      await page.goto("/profile");
      await expect(
        page.getByRole("heading", { name: "Profil" }),
      ).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Informasi Pribadi")).toBeVisible();
      await expect(page.getByText("Nama Lengkap")).toBeVisible();
      await expect(page.getByText("Anggota Sejak")).toBeVisible();
      await expect(page.getByText("Status Verifikasi")).toBeVisible();
      await expect(page.getByText("Terverifikasi").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Keamanan" }),
      ).toBeVisible();
      // Personal Information strings fully translated (no English left in scope).
      await expect(page.getByText("Personal Information")).toHaveCount(0);
      await expect(page.getByText("Member Since")).toHaveCount(0);
    });
  });
});
