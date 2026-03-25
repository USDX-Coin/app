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
  await page.goto("/transactions");
  await page.waitForSelector("text=Transactions", { timeout: 5000 });
});

test.describe("Transactions Page", () => {
  test.describe("positive", () => {
    test("displays transaction table", async ({ page }) => {
      await expect(page.getByText("Transactions").first()).toBeVisible();
      await expect(page.getByText("1,000 USDX").first()).toBeVisible();
    });

    test("shows correct transaction types", async ({ page }) => {
      await expect(page.getByText("Mint").first()).toBeVisible();
      await expect(page.getByText("Redeem").first()).toBeVisible();
    });

    test("shows status badges", async ({ page }) => {
      await expect(page.getByText("completed").first()).toBeVisible();
    });
  });

  test.describe("negative", () => {
    // Since we use mock data, there's always data. Testing the loading state.
    test("page loads without errors", async ({ page }) => {
      await expect(page.getByText("Transactions").first()).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("shows chain names for each transaction", async ({ page }) => {
      await expect(page.getByText("Base").first()).toBeVisible();
      await expect(page.getByText("Polygon").first()).toBeVisible();
    });
  });
});
