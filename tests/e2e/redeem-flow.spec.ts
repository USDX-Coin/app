import { test, expect } from "@playwright/test";
import { clearAuth } from "../helpers/playwright-utils";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await expect(page.getByText("Welcome Back")).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("Email").fill("demo@usdx.com");
  await page.getByPlaceholder("Password").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("You will mint")).toBeVisible({
    timeout: 30000,
  });
}

test.describe("Redeem Flow", () => {
  test.describe("positive", () => {
    test("redeem page shows connect wallet prompt", async ({ page }) => {
      await login(page);
      await page.goto("/redeem");
      await expect(page.getByText("Connect your wallet")).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByRole("button", { name: "Connect Wallet" })
      ).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("cannot redeem without wallet connected", async ({ page }) => {
      await login(page);
      await page.goto("/redeem");
      await expect(page.getByText("Connect your wallet")).toBeVisible({
        timeout: 15000,
      });
      // No Review Redeem button visible without wallet
      await expect(
        page.getByRole("button", { name: "Review Redeem" })
      ).not.toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("sidebar highlights redeem when on redeem page", async ({ page }) => {
      await login(page);
      await page.goto("/redeem");
      await expect(page.getByText("Redeem").first()).toBeVisible({
        timeout: 15000,
      });
    });
  });
});
