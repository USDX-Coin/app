import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  seedRateLimit,
  seedWalletTransfers,
  WALLET_TRANSFER_FIXTURES as FX,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
} from "../helpers/playwright-utils";

// Transfer history + detail (USDX-701, wallet.yaml § transfers / transfer-detail).
// Runs against the mock backend: the ledger is seeded through localStorage and the
// mock answers list/detail exactly like the contract (newest first, page/take, 404
// WALLET_TRANSFER_NOT_FOUND). What these specs prove is the screen's side: API order,
// pagination, empty ≠ error, unknown status = pending, neutral 404.

async function asCustodialOwner(page: Page) {
  await forceEnglish(page);
  await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
  await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
  await page.setViewportSize({ width: 1280, height: 800 });
}

const main = (page: Page) => page.getByRole("main");

test.describe("Transfer history", () => {
  test.describe("positive", () => {
    test("lists the transfers in API order with a status badge each", async ({ page }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [FX.dropped, FX.confirmed, FX.pending, FX.reverted]);
      await page.goto("/send/history");

      await expect(main(page).getByRole("heading", { name: "Transfer history" })).toBeVisible({ timeout: 15000 });
      const rows = page.getByTestId("transfer-history-row");
      await expect(rows).toHaveCount(4);
      // Newest first — exactly the order the API answers, no client sorting.
      await expect(rows.nth(0).getByTestId("transfer-status-badge")).toHaveText("Waiting for confirmation");
      await expect(rows.nth(1).getByTestId("transfer-status-badge")).toHaveText("Successful");
      await expect(rows.nth(2).getByTestId("transfer-status-badge")).toHaveText("Failed");
      await expect(rows.nth(3).getByTestId("transfer-status-badge")).toHaveText("Failed");
      await expect(rows.nth(0)).toContainText("40.00 USDX");
    });

    test("a row opens its detail — failure explained in plain words, and back again", async ({ page }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [FX.confirmed, FX.reverted]);
      await page.goto("/send/history");

      const reverted = page.getByTestId("transfer-history-row").nth(1);
      await reverted.getByRole("link", { name: "View details" }).click();
      await expect(page).toHaveURL(new RegExp(`/send/history/${FX.reverted.id}$`));
      const panel = page.getByTestId("transfer-status");
      await expect(panel).toHaveAttribute("data-status", "FAILED", { timeout: 15000 });
      await expect(panel.getByText("Transfer failed")).toBeVisible();
      await expect(panel.getByText("Your USDX did not move. It's safe to send again.")).toBeVisible();
      await expect(page.getByTestId("transfer-failure-reason")).toHaveText("Rejected by the USDX token contract");
      await expect(panel.getByRole("link", { name: "View on explorer" })).toHaveAttribute(
        "href",
        `https://polygonscan.com/tx/${FX.reverted.txHash}`,
      );

      await page.getByRole("link", { name: "Back to transfer history" }).click();
      await expect(page).toHaveURL(/\/send\/history$/);
      await expect(page.getByTestId("transfer-history-row")).toHaveCount(2);
    });

    test("paginates 10 per page", async ({ page }) => {
      await asCustodialOwner(page);
      const many = Array.from({ length: 12 }, (_, i) => ({
        ...FX.confirmed,
        id: `0193abce-11aa-7bcd-8e01-5c2f0a9d4f${String(i).padStart(2, "0")}`,
        submittedAt: new Date(Date.UTC(2026, 7, 28, 4, i)).toISOString(),
        amount: `${i + 1}.000000`,
      }));
      await seedWalletTransfers(page, many);
      await page.goto("/send/history");

      const rows = page.getByTestId("transfer-history-row");
      await expect(rows).toHaveCount(10, { timeout: 15000 });
      await expect(rows.first()).toContainText("12.00 USDX"); // newest
      await page.getByRole("button", { name: /Next/ }).click();
      await expect(rows).toHaveCount(2);
      await expect(rows.last()).toContainText("1.00 USDX"); // oldest
    });

    test("the history is reachable from /send and from /history", async ({ page }) => {
      await asCustodialOwner(page);
      await page.goto("/send");
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await page.getByTestId("transfer-history-link").click();
      await expect(page).toHaveURL(/\/send\/history$/);

      await page.goto("/history");
      await page.getByTestId("transfer-history-link").click();
      await expect(page).toHaveURL(/\/send\/history$/);
    });
  });

  test.describe("negative", () => {
    test("a stale or wrong id → neutral 'not found' with the way back, not an error", async ({ page }) => {
      await asCustodialOwner(page);
      await page.goto("/send/history/0193abce-11aa-7bcd-8e01-5c2f0a9d4eff");

      const notFound = page.getByTestId("transfer-detail-not-found");
      await expect(notFound).toBeVisible({ timeout: 15000 });
      await expect(notFound.getByText("Transfer not found")).toBeVisible();
      await expect(page.getByTestId("transfer-detail-error")).toHaveCount(0);
      await notFound.getByRole("link", { name: "Back to transfer history" }).click();
      await expect(page).toHaveURL(/\/send\/history$/);
    });

    test("a failed load is an error with retry — never the empty history", async ({ page }) => {
      await asCustodialOwner(page);
      await seedRateLimit(page, 1); // the list keeps answering 429 (Retry-After 1 s)
      await page.goto("/send/history");
      // The hook backs off to Retry-After twice first; only then the error state.

      await expect(page.getByTestId("transfer-history-error")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("transfer-history-error")).toContainText("Transfer history could not be loaded");
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(page.getByTestId("transfer-history-empty")).toHaveCount(0);
    });

    test("no history link for a user without a custodial wallet", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/history");
      await expect(main(page).getByRole("heading", { name: "Transaction History" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("transfer-history-link")).toHaveCount(0);
    });
  });

  test.describe("edge case", () => {
    test("no transfers yet → the empty state with a way to send", async ({ page }) => {
      await asCustodialOwner(page);
      await page.goto("/send/history");

      const empty = page.getByTestId("transfer-history-empty");
      await expect(empty).toBeVisible({ timeout: 15000 });
      await expect(empty.getByText("No transfers yet")).toBeVisible();
      await empty.getByRole("button", { name: "Send USDX" }).click();
      await expect(page).toHaveURL(/\/send$/);
    });

    test("a status the app does not know yet reads as 'Waiting for confirmation'", async ({ page }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [{ ...FX.pending, status: "SETTLING" }]);
      await page.goto("/send/history");

      const row = page.getByTestId("transfer-history-row");
      await expect(row.getByTestId("transfer-status-badge")).toHaveText("Waiting for confirmation", { timeout: 15000 });
      await expect(main(page).getByText("SETTLING")).toHaveCount(0);
    });

    test("phone width shows cards that open the detail", async ({ page }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [FX.dropped]);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/send/history");

      const card = page.getByTestId("transfer-history-card");
      await expect(card).toHaveCount(1, { timeout: 15000 });
      await card.click();
      await expect(page.getByTestId("transfer-failure-reason")).toHaveText(
        "Replaced by another transaction from the same wallet",
        { timeout: 15000 },
      );
    });
  });
});
