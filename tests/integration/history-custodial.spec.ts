import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
  VIEWPORTS,
} from "../helpers/playwright-utils";

// "Wallet custodial saya" marker on /history (USDX-653, custodial-wallet.md §5.2).
// The mock history seeds (mock-api `seededMintUserAddress`): mint 100 → the mock
// custodial wallet, mint 250 → the same address all lowercase, the other mints →
// an address-book wallet; redeem 100 → from the custodial wallet, the other
// redeems → the address-book wallet.

async function openHistory(page: Page, { custodial }: { custodial: boolean }) {
  await forceEnglish(page);
  if (custodial) {
    await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
    await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
  } else {
    await loginViaStorage(page);
  }
  await page.goto("/history");
  await expect(page.getByText("Transaction History")).toBeVisible({ timeout: 15000 });
}

async function showType(page: Page, tab: "Minting" | "Redeem") {
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await expect(page.locator("table")).toBeVisible();
}

// The desktop table row of the active tab whose USDX amount cell is exactly
// `amount` (EN locale: "100.00" — a substring match would also hit an IDR cell
// such as "Rp 4.100.000"). The type text matters: right after a tab switch the
// previous page is still on screen (`keepPreviousData`) with rows of the other type.
function row(page: Page, type: "Minting" | "Redeem", amount: string) {
  return page
    .getByRole("tabpanel")
    .locator("table tbody tr")
    .filter({ hasText: type })
    .filter({ has: page.getByRole("cell", { name: amount, exact: true }) });
}

test.describe("History — custodial wallet marker", () => {
  test.describe("positive", () => {
    test("a mint to the custodial wallet reads 'To my custodial wallet'", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await openHistory(page, { custodial: true });
      await showType(page, "Minting");
      await expect(row(page, "Minting", "100.00").getByTestId("tx-custodial-marker")).toHaveText(
        "To my custodial wallet",
      );
    });

    test("a redeem burned from the custodial wallet reads 'From my custodial wallet'", async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await openHistory(page, { custodial: true });
      await showType(page, "Redeem");
      await expect(row(page, "Redeem", "100.00").getByTestId("tx-custodial-marker")).toHaveText(
        "From my custodial wallet",
      );
    });
  });

  test.describe("negative", () => {
    test("orders to/from another address carry no marker", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await openHistory(page, { custodial: true });
      await showType(page, "Minting");
      await expect(row(page, "Minting", "500.00")).toBeVisible();
      await expect(row(page, "Minting", "500.00").getByTestId("tx-custodial-marker")).toHaveCount(0);
      await showType(page, "Redeem");
      await expect(row(page, "Redeem", "250.00")).toBeVisible();
      await expect(row(page, "Redeem", "250.00").getByTestId("tx-custodial-marker")).toHaveCount(0);
    });

    test("a user without a custodial wallet sees no marker at all", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await openHistory(page, { custodial: false });
      // The same seeded rows are there, just unmarked.
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await expect(page.getByTestId("tx-custodial-marker")).toHaveCount(0);
    });
  });

  test.describe("edge case", () => {
    test("the custodial address stored all lowercase is still marked", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await openHistory(page, { custodial: true });
      await showType(page, "Minting");
      await expect(row(page, "Minting", "250.00").getByTestId("tx-custodial-marker")).toHaveText(
        "To my custodial wallet",
      );
    });

    test("the mobile cards show the marker too", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await openHistory(page, { custodial: true });
      await page.getByRole("tab", { name: "Minting", exact: true }).click();
      // Table is hidden below `lg`; the visible marker lives in the card.
      await expect(page.getByTestId("tx-custodial-marker").filter({ visible: true }).first()).toHaveText(
        "To my custodial wallet",
      );
    });
  });
});
