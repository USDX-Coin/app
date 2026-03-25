import { test, expect } from "@playwright/test";

async function loginViaStorage(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.evaluate(() => {
    const authState = {
      state: {
        user: {
          id: "usr_1",
          fullName: "Demo User",
          email: "demo@usdx.com",
          isVerified: true,
          createdAt: "2026-01-01T00:00:00Z",
        },
        token: "mock-token",
        isAuthenticated: true,
      },
      version: 0,
    };
    localStorage.setItem("usdx-auth", JSON.stringify(authState));
  });
}

test.beforeEach(async ({ page }) => {
  await loginViaStorage(page);
  await page.goto("/profile");
  await page.waitForSelector("text=Profile", { timeout: 5000 });
});

test.describe("Profile Page", () => {
  test.describe("positive", () => {
    test("displays user info", async ({ page }) => {
      await expect(page.getByText("Demo User")).toBeVisible();
      await expect(page.getByText("demo@usdx.com")).toBeVisible();
    });

    test("shows verification badge", async ({ page }) => {
      await expect(
        page.getByText("Your Account Is Verified")
      ).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("page renders without errors", async ({ page }) => {
      await expect(page.getByText("Full Name")).toBeVisible();
      await expect(page.getByText("Email")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("shows member since date", async ({ page }) => {
      await expect(page.getByText("Member Since")).toBeVisible();
      await expect(page.getByText("1/1/2026")).toBeVisible();
    });
  });
});
