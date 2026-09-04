import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";

async function login(page: import("@playwright/test").Page) {
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

test.describe("Mint Flow", () => {
  test.describe("positive", () => {
    test("complete mint flow: form -> Ringkasan modal -> redirect handoff to checkout", async ({
      page,
    }) => {
      await login(page);

      // Checkout lives in a separate repo/origin (mint.usdx.co.id) — stub it so the
      // cross-origin handoff lands on a controllable page, not the real site.
      await page.route("https://mint.usdx.co.id/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/html", body: "<h1>checkout</h1>" }),
      );

      // Fill mint form
      await page.getByPlaceholder("0", { exact: true }).fill("250");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();

      // Ringkasan (review) modal
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("250 USDX").first()).toBeVisible();
      await expect(page.getByText("0xabcd...ef12")).toBeVisible();

      // Proceed -> creates the order (POST /v2/mint) -> hands off (cross-origin) to
      // mint.usdx.co.id/checkout/{orderId} (USDX-225).
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await page.waitForURL(/^https:\/\/mint\.usdx\.co\.id\/checkout\/mint_/, { timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("cannot proceed with invalid form", async ({ page }) => {
      await login(page);
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });
  });

  test.describe("edge cases", () => {
    test("can cancel the Ringkasan modal and change amount", async ({ page }) => {
      await login(page);
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();

      // Cancel closes the modal, form stays
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByText("Transaction Summary")).not.toBeVisible();
      await expect(page.getByText("You will mint")).toBeVisible();
    });
  });
});
