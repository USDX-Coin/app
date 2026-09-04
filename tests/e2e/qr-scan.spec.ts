import { test, expect, type Page } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// The QR address scanner (USDX-217). Decoding a real QR needs a camera feed, so
// E2E covers the surface (opens, shows guidance, closes) — the decode/parse logic
// is unit-tested in validations.test.ts (parseScannedAddress).

async function login(page: Page) {
  await forceEnglish(page);
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("you@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("Enter your password").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 30000 });
}

test.describe("QR Scanner", () => {
  test.describe("positive", () => {
    test("scan button on the mint 'To' field opens the scanner dialog", async ({ page }) => {
      await login(page);

      await page.getByRole("button", { name: "Scan QR code" }).click();

      await expect(page.getByRole("heading", { name: "Scan QR" })).toBeVisible();
      await expect(
        page.getByText("Point your camera at a QR code containing a wallet address."),
      ).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("closing the scanner returns to the mint form", async ({ page }) => {
      await login(page);
      await page.getByRole("button", { name: "Scan QR code" }).click();
      await expect(page.getByRole("heading", { name: "Scan QR" })).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { name: "Scan QR" })).not.toBeVisible();
      await expect(page.getByText("You will mint")).toBeVisible();
    });
  });
});
