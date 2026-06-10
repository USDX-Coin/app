import { test, expect } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({
    timeout: 15000,
  });
});

test.describe("Profile Page", () => {
  test.describe("positive", () => {
    test("displays user info", async ({ page }) => {
      // Name also appears in the sidebar account switcher — assert the first match.
      await expect(page.getByText("Demo User").first()).toBeVisible();
      await expect(page.getByText("demo@usdx.com")).toBeVisible();
    });

    test("shows verification badge", async ({ page }) => {
      await expect(page.getByText("Verified", { exact: true })).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("page renders without errors", async ({ page }) => {
      await expect(page.getByText("Personal Information")).toBeVisible();
      await expect(page.getByText("Security")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("shows member since date in formal format", async ({ page }) => {
      await expect(page.getByText("Member Since")).toBeVisible();
      await expect(page.getByText("January 1, 2026")).toBeVisible();
    });
  });
});
