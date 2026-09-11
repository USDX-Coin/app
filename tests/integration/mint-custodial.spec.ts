import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  MOCK_CUSTODIAL_ADDRESS,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
} from "../helpers/playwright-utils";

// Mint destination "my custodial wallet" (USDX-567, custodial-wallet.md §5.2).
// No new API field: the custodial address fills `userAddress`. The spec proves
// the UI half — default selection, nothing to type, the marker in the summary,
// and the manual path still there behind the switch.
test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await seedCustodialWallet(page);
  await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
  await page.goto("/mint");
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
});

test.describe("Mint — custodial destination", () => {
  test.describe("positive", () => {
    test("defaults to the custodial wallet: address shown, no address input, Mint enabled from the amount alone", async ({
      page,
    }) => {
      await expect(page.getByTestId("mint-dest-custodial")).toContainText(MOCK_CUSTODIAL_ADDRESS);
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toHaveCount(0);
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeEnabled();
    });

    test("the summary marks the recipient as the custodial wallet and hands off to checkout", async ({
      page,
    }) => {
      await page.route("https://mint.usdx.co.id/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/html", body: "<h1>checkout</h1>" }),
      );
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByTestId("mint-review-custodial")).toContainText("My custodial wallet");
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await page.waitForURL(/^https:\/\/mint\.usdx\.co\.id\/checkout\/mint_/, { timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("without a custodial wallet the switch is absent and the address input is back", async ({
      page,
    }) => {
      await page.addInitScript(() => localStorage.removeItem("usdx-mock-custodial"));
      await loginViaStorage(page);
      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("radio", { name: "My custodial wallet" })).toHaveCount(0);
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("'Another address' brings back the manual field, address book and scanner", async ({
      page,
    }) => {
      await page.getByRole("radio", { name: "Another address" }).click();
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toBeVisible();
      await expect(page.getByRole("button", { name: "Address book" }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Scan QR code" })).toBeVisible();
      await expect(page.getByTestId("mint-dest-custodial")).toHaveCount(0);
    });
  });
});
