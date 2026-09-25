import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  seedIncomingTransfers,
  seedWalletTransfers,
  INCOMING_TRANSFER_FIXTURES as IN,
  WALLET_TRANSFER_FIXTURES as FX,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
} from "../helpers/playwright-utils";

// Custodial transfers in the unified /history (USDX-713, custodial-wallet.md §5.7) +
// the transfer detail (USDX-701). Runs against the mock backend: both ledgers are
// seeded through localStorage and the mock answers GET /api/v2/transactions like the
// contract (type / includeTransfers, newest first, page/take). What these specs prove
// is the screen's side: tabs + URL filter, incoming vs outgoing rows, the detail and
// back, the redirect of the old list route, empty ≠ error, unknown status = pending.

async function asCustodialOwner(page: Page) {
  await forceEnglish(page);
  await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
  await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
  await page.setViewportSize({ width: 1280, height: 800 });
}

const main = (page: Page) => page.getByRole("main");
const transferRows = (page: Page) => page.getByTestId("history-transfer-row");
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });

test.describe("Unified history — custodial transfers", () => {
  test.describe("positive", () => {
    test("'All Transaction' mixes mint, redeem, incoming and outgoing in one list", async ({ page }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [FX.confirmed]);
      await seedIncomingTransfers(page, [IN.confirmed]);
      await page.goto("/history");

      await expect(tab(page, "All Transaction")).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
      await expect(transferRows(page)).toHaveCount(2);
      await expect(transferRows(page).filter({ hasText: "Incoming" })).toHaveCount(1);
      await expect(transferRows(page).filter({ hasText: "Outgoing" })).toHaveCount(1);
      // Orders are still there, next to the transfers.
      await expect(main(page).locator("table").getByText("Minting").first()).toBeVisible();
    });

    test("'Incoming' shows only incoming rows: sender address, pending → successful labels, row menu", async ({
      page,
    }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [FX.confirmed]);
      await seedIncomingTransfers(page, [IN.confirmed, IN.pending]);
      await page.goto("/history");

      await tab(page, "Incoming").click();
      await expect(page).toHaveURL(/\/history\?type=TRANSFER_IN$/);
      const rows = transferRows(page);
      await expect(rows).toHaveCount(2, { timeout: 15000 });
      await expect(rows.filter({ hasText: "Outgoing" })).toHaveCount(0);
      await expect(rows.nth(0).getByTestId("transfer-status-badge")).toHaveText("Waiting for confirmation");
      await expect(rows.nth(1).getByTestId("transfer-status-badge")).toHaveText("Successful");
      await expect(rows.nth(0)).toContainText("From 0x7c0A3d...3F0E28");
      await expect(rows.nth(0).getByRole("link", { name: "View details" })).toHaveCount(0);

      await rows.nth(0).getByRole("button", { name: "Transaction actions" }).click();
      await expect(page.getByRole("menuitem", { name: "Open in explorer" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Copy hash" })).toBeVisible();
    });

    test("'Outgoing' keeps a failed transfer with its reason; its row opens the detail, and back lands on 'Outgoing'", async ({
      page,
    }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [FX.confirmed, FX.reverted]);
      await seedIncomingTransfers(page, [IN.confirmed]);
      await page.goto("/history");

      await tab(page, "Outgoing").click();
      await expect(page).toHaveURL(/\/history\?type=TRANSFER_OUT$/);
      const rows = transferRows(page);
      await expect(rows).toHaveCount(2, { timeout: 15000 });
      const reverted = rows.nth(1);
      await expect(reverted.getByTestId("transfer-status-badge")).toHaveText("Failed");
      await expect(reverted).toContainText("Your USDX did not move. It's safe to send again.");
      await expect(reverted).toContainText("To 0x5aAeb6...1BeAed");

      await reverted.getByRole("link", { name: "View details" }).click();
      await expect(page).toHaveURL(new RegExp(`/send/history/${FX.reverted.id}$`));
      await expect(page.getByTestId("transfer-status")).toHaveAttribute("data-status", "FAILED", { timeout: 15000 });
      await expect(page.getByTestId("transfer-failure-reason")).toHaveText("Rejected by the USDX token contract");

      await page.getByRole("link", { name: "Back to transfer history" }).click();
      await expect(page).toHaveURL(/\/history\?type=TRANSFER_OUT$/);
      await expect(tab(page, "Outgoing")).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
      await expect(transferRows(page)).toHaveCount(2);
    });

    test("paginates 10 per page on the server's order", async ({ page }) => {
      await asCustodialOwner(page);
      const many = Array.from({ length: 12 }, (_, i) => ({
        ...FX.confirmed,
        id: `0193abce-11aa-7bcd-8e01-5c2f0a9d4f${String(i).padStart(2, "0")}`,
        submittedAt: new Date(Date.UTC(2026, 7, 28, 4, i)).toISOString(),
        amount: `${i + 1}.000000`,
      }));
      await seedWalletTransfers(page, many);
      await page.goto("/history?type=TRANSFER_OUT");

      const rows = transferRows(page);
      await expect(rows).toHaveCount(10, { timeout: 15000 });
      await expect(rows.first()).toContainText("12.00"); // newest
      await page.getByRole("button", { name: /Next/ }).click();
      await expect(rows).toHaveCount(2);
      await expect(rows.last()).toContainText("1.00"); // oldest
    });

    test("neither /send nor /history has a 'Transfer history' button any more", async ({ page }) => {
      await asCustodialOwner(page);
      await page.goto("/send");
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await expect(main(page).getByRole("link", { name: "Transfer history" })).toHaveCount(0);

      await page.goto("/history");
      await expect(tab(page, "All Transaction")).toBeVisible({ timeout: 15000 });
      await expect(main(page).getByRole("link", { name: "Transfer history" })).toHaveCount(0);
    });
  });

  test.describe("negative", () => {
    test("the old list route /send/history redirects to /history with 'Outgoing' active", async ({ page }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [FX.confirmed]);
      await page.goto("/send/history");

      await expect(page).toHaveURL(/\/history\?type=TRANSFER_OUT$/, { timeout: 15000 });
      await expect(tab(page, "Outgoing")).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
      await expect(transferRows(page)).toHaveCount(1);
    });

    test("a stale or wrong detail id → neutral 'not found', and the way back is 'Outgoing'", async ({ page }) => {
      await asCustodialOwner(page);
      await page.goto("/send/history/0193abce-11aa-7bcd-8e01-5c2f0a9d4eff");

      const notFound = page.getByTestId("transfer-detail-not-found");
      await expect(notFound).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("transfer-detail-error")).toHaveCount(0);
      await notFound.getByRole("link", { name: "Back to transfer history" }).click();
      await expect(page).toHaveURL(/\/history\?type=TRANSFER_OUT$/);
    });

    test("a user without a custodial wallet: 'All' still lists mint + redeem; 'Incoming' is the filter-empty state", async ({
      page,
    }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/history");

      await expect(main(page).locator("table").getByText("Minting").first()).toBeVisible({ timeout: 15000 });
      await expect(transferRows(page)).toHaveCount(0);
      await tab(page, "Incoming").click();
      await expect(main(page).getByText("Nothing matches this filter")).toBeVisible({ timeout: 15000 });
      await expect(main(page).getByRole("alert")).toHaveCount(0);
    });
  });

  test.describe("edge case", () => {
    test("opening /history?type=TRANSFER_IN lands on 'Incoming'", async ({ page }) => {
      await asCustodialOwner(page);
      await seedIncomingTransfers(page, [IN.confirmed]);
      await page.goto("/history?type=TRANSFER_IN");

      await expect(tab(page, "Incoming")).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
      await expect(transferRows(page)).toHaveCount(1);
    });

    test("a status the app does not know yet reads as 'Waiting for confirmation'", async ({ page }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [{ ...FX.pending, status: "SETTLING" }]);
      await page.goto("/history?type=TRANSFER_OUT");

      const row = transferRows(page);
      await expect(row.getByTestId("transfer-status-badge")).toHaveText("Waiting for confirmation", { timeout: 15000 });
      await expect(main(page).getByText("SETTLING")).toHaveCount(0);
    });

    test("phone width shows an outgoing card that opens the detail", async ({ page }) => {
      await asCustodialOwner(page);
      await seedWalletTransfers(page, [FX.dropped]);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/history?type=TRANSFER_OUT");

      const card = page.getByTestId("history-transfer-card");
      await expect(card).toHaveCount(1, { timeout: 15000 });
      await card.click();
      await expect(page.getByTestId("transfer-failure-reason")).toHaveText(
        "Replaced by another transaction from the same wallet",
        { timeout: 15000 },
      );
    });
  });
});
