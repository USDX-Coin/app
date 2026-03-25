import { test, expect } from "@playwright/test";
import { loginViaStorage, VIEWPORTS } from "../../helpers/playwright-utils";

test.use({ viewport: VIEWPORTS.tablet });

test.describe("Tablet Responsive (768x1024)", () => {
  test("dashboard shows sidebar at md breakpoint", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/mint");
    await expect(page.getByText("Mint").first()).toBeVisible({ timeout: 15000 });

    // Sidebar should be visible on tablet
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("mint form still stacked (not side-by-side at md)", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/mint");
    await expect(page.getByText("Mint").first()).toBeVisible({ timeout: 15000 });

    // Form should be full width (not in flex-row at md)
    const formCard = page.locator(".rounded-2xl").first();
    await expect(formCard).toBeVisible();
  });

  test("transactions show table view", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/transactions");
    await expect(page.getByText("Transactions").first()).toBeVisible({ timeout: 15000 });

    // Table should be visible on tablet
    const table = page.locator("table");
    await expect(table).toBeVisible();
  });
});
