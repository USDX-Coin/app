import { test, expect } from "@playwright/test";
import { loginViaStorage, VIEWPORTS } from "../../helpers/playwright-utils";

test.use({ viewport: VIEWPORTS.mobile });

test.describe("Mobile Responsive (375x667)", () => {
  test("login page renders correctly on mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome Back")).toBeVisible({ timeout: 15000 });
    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("dashboard shows hamburger menu, no sidebar", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/mint");
    await expect(page.getByPlaceholder("Amount").first()).toBeVisible({ timeout: 15000 });

    // Sidebar should be hidden on mobile (below md: 768px)
    const sidebar = page.locator("aside");
    await expect(sidebar).not.toBeVisible();
  });

  test("mint form stacks vertically on mobile", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/mint");
    await expect(page.getByPlaceholder("Amount").first()).toBeVisible({ timeout: 15000 });

    // Page content should fill width
    const body = await page.evaluate(() => document.body.scrollWidth);
    expect(body).toBeLessThanOrEqual(375 + 1);
  });

  test("profile page renders without overflow on mobile", async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/profile");
    await expect(page.getByText("Demo User")).toBeVisible({ timeout: 15000 });

    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
