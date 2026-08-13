import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
} from "../helpers/playwright-utils";

// Bridge and Send have no backend yet, but the PM keeps them in the sidebar as
// promotion teasers (13 Aug): visible item + a "Coming Soon" pill, clicking
// lands on the ComingSoon page. These specs pin the three things that decision
// puts at risk — the pill actually renders in both locales, the rows still
// navigate and still take the active style, and the pill adds no tab stop.

const sidebar = (page: Page) => page.locator("aside");

async function gotoDashboard(page: Page) {
  await loginViaStorage(page);
  await page.goto("/mint");
  await expect(sidebar(page)).toBeVisible({ timeout: 15000 });
}

test.describe("Sidebar Coming Soon teasers", () => {
  test.describe("positive", () => {
    test("Bridge and Send stay visible with a Coming Soon pill", async ({
      page,
    }) => {
      await forceEnglish(page);
      await gotoDashboard(page);

      const bridge = sidebar(page).getByRole("link", { name: "Bridge Coming Soon" });
      const send = sidebar(page).getByRole("link", { name: "Send Coming Soon" });

      await expect(bridge).toBeVisible();
      await expect(bridge).toHaveAttribute("href", "/bridge");
      await expect(send).toBeVisible();
      await expect(send).toHaveAttribute("href", "/send");
    });

    test("clicking the Bridge teaser opens the ComingSoon page", async ({
      page,
    }) => {
      await forceEnglish(page);
      await gotoDashboard(page);

      await sidebar(page)
        .getByRole("link", { name: "Bridge Coming Soon" })
        .click();

      await expect(page).toHaveURL(/\/bridge$/);
      await expect(
        page.getByRole("main").getByText("Coming soon", { exact: true })
      ).toBeVisible({ timeout: 15000 });
    });

    test("clicking the Send teaser opens the ComingSoon page", async ({
      page,
    }) => {
      await forceEnglish(page);
      await gotoDashboard(page);

      await sidebar(page).getByRole("link", { name: "Send Coming Soon" }).click();

      await expect(page).toHaveURL(/\/send$/);
      await expect(
        page.getByRole("main").getByText("Coming soon", { exact: true })
      ).toBeVisible({ timeout: 15000 });
    });

    test("the teaser row still takes the active highlight on its own route", async ({
      page,
    }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/bridge");
      await expect(sidebar(page)).toBeVisible({ timeout: 15000 });

      // Active rows paint the brand gradient; inactive ones carry no image.
      await expect(
        sidebar(page).getByRole("link", { name: "Bridge Coming Soon" })
      ).toHaveCSS("background-image", /linear-gradient/);
      await expect(
        sidebar(page).getByRole("link", { name: "Send Coming Soon" })
      ).toHaveCSS("background-image", "none");
    });
  });

  test.describe("negative", () => {
    test("working routes carry no pill", async ({ page }) => {
      await forceEnglish(page);
      await gotoDashboard(page);

      await expect(
        sidebar(page).getByRole("link", { name: "Mint", exact: true })
      ).toBeVisible();
      await expect(
        sidebar(page).getByRole("link", { name: "Redeem", exact: true })
      ).toBeVisible();
      // Exactly two pills in the whole sidebar — Bridge and Send.
      await expect(sidebar(page).getByText("Coming Soon", { exact: true })).toHaveCount(2);
    });
  });

  test.describe("edge cases", () => {
    test("the pill adds no extra tab stop", async ({ page }) => {
      await forceEnglish(page);
      await gotoDashboard(page);

      await sidebar(page).getByRole("link", { name: "Bridge Coming Soon" }).focus();
      await page.keyboard.press("Tab");

      // Focus lands on the next nav row, not on the pill inside the Bridge row.
      await expect
        .poll(() =>
          page.evaluate(() => document.activeElement?.getAttribute("href") ?? null)
        )
        .toBe("/send");
    });

    test("Enter activates the focused teaser", async ({ page }) => {
      await forceEnglish(page);
      await gotoDashboard(page);

      await sidebar(page).getByRole("link", { name: "Bridge Coming Soon" }).focus();
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(/\/bridge$/);
    });

    test("the pill is translated in the Indonesian locale", async ({ page }) => {
      await forceIndonesian(page);
      await gotoDashboard(page);

      await expect(
        sidebar(page).getByRole("link", { name: "Bridge Segera Hadir" })
      ).toBeVisible();
      await expect(
        sidebar(page).getByRole("link", { name: "Kirim Segera Hadir" })
      ).toBeVisible();
    });
  });
});
