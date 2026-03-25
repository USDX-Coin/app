import { test, expect } from "@playwright/test";
import { loginViaStorage, VIEWPORTS } from "../../helpers/playwright-utils";

test.use({ viewport: VIEWPORTS.desktop });

test.describe("Desktop Responsive (1280x720)", () => {
  test("full sidebar visible", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/mint");
    await expect(page.getByText("Mint").first()).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("header shows all elements", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/mint");
    await expect(page.getByText("Mint").first()).toBeVisible({ timeout: 15000 });

    // EN label visible on desktop
    await expect(page.getByText("EN")).toBeVisible();
    // Avatar dropdown visible
    await expect(page.getByText("DU")).toBeVisible();
  });

  test("transactions show full table", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/transactions");
    await expect(page.getByText("Transactions").first()).toBeVisible({ timeout: 15000 });

    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(page.getByText("Date").first()).toBeVisible();
    await expect(page.getByText("Tx Hash").first()).toBeVisible();
  });
});
