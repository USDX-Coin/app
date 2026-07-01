import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage } from "../helpers/playwright-utils";

// Locale is persisted in localStorage before any page script runs. Kept local
// to this spec so it stays independent of shared helpers (USDX-177 ships in
// parallel with the /profile i18n work in USDX-176).
async function setLocale(page: Page, lang: "en" | "id") {
  await page.addInitScript((l) => localStorage.setItem("usdx-lang", l), lang);
}

async function gotoProfile(page: Page, heading: string) {
  await loginViaStorage(page);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Profile Preferences (USDX-177)", () => {
  test.describe("positive", () => {
    test("shows only the real Language control, wired to the active locale", async ({
      page,
    }) => {
      await setLocale(page, "en");
      await gotoProfile(page, "Preferences");
      const main = page.locator("main");
      await expect(main.getByText("Language")).toBeVisible();
      // Value comes from the active LanguageProvider locale, not a hardcode.
      await expect(main.getByText("English", { exact: true })).toBeVisible();
    });

    test("Language reflects the active locale (ID → Indonesia)", async ({
      page,
    }) => {
      await setLocale(page, "id");
      await gotoProfile(page, "Preferensi");
      await expect(
        page.locator("main").getByText("Indonesia", { exact: true }),
      ).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("no longer renders the dropped mock claims", async ({ page }) => {
      await setLocale(page, "en");
      await gotoProfile(page, "Preferences");
      await expect(page.getByText("Email Notifications")).toHaveCount(0);
      await expect(page.getByText("Currency Display")).toHaveCount(0);
      await expect(page.getByText("Default Network")).toHaveCount(0);
    });
  });

  test.describe("edge cases", () => {
    test("renders Preferences strings in Indonesian", async ({ page }) => {
      await setLocale(page, "id");
      await gotoProfile(page, "Preferensi");
      await expect(page.locator("main").getByText("Bahasa")).toBeVisible();
    });
  });
});
