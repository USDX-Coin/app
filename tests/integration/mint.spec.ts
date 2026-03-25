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
  await page.goto("/mint");
  await page.waitForSelector("h1:has-text('Mint')", { timeout: 15000 });
});

test.describe("Mint Page", () => {
  test.describe("positive", () => {
    test("displays mint form correctly", async ({ page }) => {
      await expect(page.getByText("You will mint")).toBeVisible();
      await expect(page.getByText("You will pay")).toBeVisible();
      await expect(page.getByText("1 USDX = 1 USD")).toBeVisible();
      await expect(page.getByText("To this address")).toBeVisible();
    });

    test("chain selector shows USDX on Base by default", async ({
      page,
    }) => {
      await expect(page.getByText("USDX on Base")).toBeVisible();
    });

    test("enables Review Mint when form is valid", async ({ page }) => {
      await page.getByPlaceholder("Amount").first().fill("100");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0x1234567890abcdef1234567890abcdef12345678");
      await expect(
        page.getByRole("button", { name: "Review Mint" })
      ).toBeEnabled();
    });

    test("shows review panel after clicking Review Mint", async ({
      page,
    }) => {
      await page.getByPlaceholder("Amount").first().fill("500");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0x1234567890abcdef1234567890abcdef12345678");
      await page.getByRole("button", { name: "Review Mint" }).click();
      await expect(page.getByText("Mint Detail")).toBeVisible();
      await expect(page.getByText("500 USDX")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Proceed Payment" })
      ).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("Review Mint is disabled when form is empty", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Review Mint" })
      ).toBeDisabled();
    });

    test("shows validation error for amount below minimum", async ({
      page,
    }) => {
      await page.getByPlaceholder("Amount").first().fill("5");
      await page
        .getByPlaceholder("Destination Address")
        .fill("0x1234567890abcdef1234567890abcdef12345678");
      await expect(
        page.getByText("Minimum amount is 10 USDX")
      ).toBeVisible();
    });

    test("shows validation error for invalid address", async ({
      page,
    }) => {
      await page.getByPlaceholder("Amount").first().fill("100");
      await page.getByPlaceholder("Destination Address").fill("0xinvalid");
      await expect(
        page.getByText("Invalid EVM address (must be 42 chars)")
      ).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("auto-calculates payment amount", async ({ page }) => {
      await page.getByPlaceholder("Amount").first().fill("1000");
      // Wait for calculation
      await page.waitForTimeout(500);
      const paymentInput = page.getByPlaceholder("Amount").nth(1);
      await expect(paymentInput).toHaveValue("1,000");
    });

    test("can open chain selector dialog", async ({ page }) => {
      await page.getByText("USDX on Base").click();
      await expect(page.getByText("Select Network")).toBeVisible();
      await expect(
        page.getByPlaceholder("Search network...")
      ).toBeVisible();
    });
  });
});
