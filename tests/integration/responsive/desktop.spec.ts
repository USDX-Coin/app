import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish, VIEWPORTS } from "../../helpers/playwright-utils";

test.use({ viewport: VIEWPORTS.desktop });

test.describe("Desktop Responsive (1280x720)", () => {
  test("full sidebar visible", async ({ page }) => {
    await forceEnglish(page);
    await loginViaStorage(page);
    await page.goto("/mint");
    await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("sidebar shows account, balance, and language elements", async ({ page }) => {
    // The top Header was replaced by the sidebar account switcher + balance card.
    await forceEnglish(page);
    await loginViaStorage(page);
    await page.goto("/mint");
    await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole("button", { name: /Demo User/ })).toBeVisible();
    await expect(page.getByText("Total balance")).toBeVisible();
    // An aria-label on the language button, never visible text — `getByText`
    // could not have matched it. The name also carries the current language.
    await expect(
      page.getByRole("button", { name: /Selected Language: English/ })
    ).toBeVisible();
  });

  test("history shows full table", async ({ page }) => {
    await forceEnglish(page);
    await loginViaStorage(page);
    await page.goto("/history");
    await expect(page.getByText("Transaction History")).toBeVisible({ timeout: 15000 });

    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(page.getByText("Date Time").first()).toBeVisible();
    await expect(page.getByText("Tx hash").first()).toBeVisible();
  });
});
