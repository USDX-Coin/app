import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  seedRateLimit,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
  MOCK_PIN,
} from "../helpers/playwright-utils";

// Transfer from the custodial wallet (USDX-567, wallet.yaml § POST
// /api/v2/wallet/transfer): form → Ringkasan → PIN → 202 → confirmation tracker
// (USDX-701, GET /api/v2/wallet/transfers/{id}). No wallet extension is involved
// anywhere on this path. The mock enforces the contract's idempotency + error
// precedence and plays the receipt watcher (PENDING → final after 3.5 s), so what
// these specs prove is the UI's side of it: the PIN failures stay in the PIN
// dialog, the balance is re-read after a broadcast, and the screen says
// "successful" only once the backend reports CONFIRMED.
const TO = "0xabcdef1234567890abcdef1234567890abcdef12";

async function openPinDialog(page: import("@playwright/test").Page, amount = "25") {
  await page.goto("/send");
  await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("0", { exact: true }).fill(amount);
  await page.getByPlaceholder("0x5DC489Ad05Efc").fill(TO);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Transaction Summary")).toBeVisible();
  await page.getByRole("button", { name: "Continue to PIN" }).click();
  const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
  await expect(pin).toBeVisible();
  return pin;
}

test.describe("Transfer Flow (custodial)", () => {
  test.describe("positive", () => {
    test.beforeEach(async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
    });

    test("form → Ringkasan → PIN → 202 → tracker PENDING → CONFIRMED, balance refreshed", async ({
      page,
    }) => {
      await page.goto("/send");
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      // Source is fixed to the custodial wallet; the balance comes from GET /wallet.
      await expect(page.getByTestId("transfer-balance")).toHaveText("1,000 USDX", { timeout: 15000 });
      // No external wallet anywhere on this page.
      await expect(page.getByRole("button", { name: /connect/i })).toHaveCount(0);

      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();

      const result = page.getByTestId("transfer-result");
      await expect(result).toBeVisible({ timeout: 15000 });
      const status = result.getByTestId("transfer-status");
      // 202 = proof of broadcast: "waiting for confirmation", not a success claim.
      await expect(status).toHaveAttribute("data-status", "PENDING");
      await expect(result.getByText("Sent — waiting for confirmation")).toBeVisible();
      await expect(result.getByText(/successful/i)).toHaveCount(0);
      await expect(result.getByRole("link", { name: "View on explorer" })).toHaveAttribute(
        "href",
        /^https:\/\/polygonscan\.com\/tx\/0x[0-9a-f]{64}$/,
      );
      await expect(result.getByText("25.00 USDX")).toBeVisible();
      // The tracker polls the detail and flips on its own — no reload.
      await expect(status).toHaveAttribute("data-status", "CONFIRMED", { timeout: 15000 });
      await expect(result.getByText("Transfer successful")).toBeVisible();

      // Back to the form: the balance reflects the debit (1,000 − 25).
      await page.getByRole("button", { name: "Send another transfer" }).click();
      await expect(page.getByTestId("transfer-balance")).toHaveText("975 USDX", { timeout: 15000 });
    });

    test("wrong PIN keeps the PIN dialog open with a clear message; the right PIN then goes through", async ({
      page,
    }) => {
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill("000000");
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(pin.getByText("Wrong PIN. Please try again.")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("transfer-result")).toHaveCount(0);

      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });

    test("the sent transfer shows up in the history with the same status, and opens the same detail", async ({
      page,
    }) => {
      const pin = await openPinDialog(page, "12");
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      const result = page.getByTestId("transfer-result");
      await expect(result.getByTestId("transfer-status")).toHaveAttribute("data-status", "CONFIRMED", {
        timeout: 15000,
      });
      const hash = await result.getByRole("link", { name: "View on explorer" }).getAttribute("href");

      await result.getByRole("link", { name: "Transfer history" }).click();
      const rows = page.getByTestId("transfer-history-row");
      await expect(rows).toHaveCount(1, { timeout: 15000 });
      await expect(rows.first()).toContainText("12.00 USDX");
      await expect(rows.first().getByTestId("transfer-status-badge")).toHaveText("Successful");
      await rows.first().getByRole("link", { name: "View details" }).click();
      await expect(page.getByTestId("transfer-status")).toHaveAttribute("data-status", "CONFIRMED", {
        timeout: 15000,
      });
      await expect(page.getByRole("link", { name: "View on explorer" })).toHaveAttribute("href", hash!);
    });

    test("history opened moments before a send shows the new transfer at once, not the empty state (review app#79)", async ({
      page,
    }) => {
      // 1. The history is opened first — empty, and now cached as fresh.
      await page.goto("/send/history");
      await expect(page.getByTestId("transfer-history-empty")).toBeVisible({ timeout: 15000 });
      // 2. Client-side navigation keeps that cache alive.
      await page.getByRole("button", { name: "Send USDX" }).click();
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("7");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(TO);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByRole("button", { name: "Continue to PIN" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      const result = page.getByTestId("transfer-result");
      await expect(result.getByTestId("transfer-status")).toHaveAttribute("data-status", "PENDING", {
        timeout: 15000,
      });
      // 3. Well inside the 15 s staleTime of the cached empty list.
      await result.getByRole("link", { name: "Transfer history" }).click();
      await expect(page.getByTestId("transfer-history-row")).toHaveCount(1, { timeout: 15000 });
      await expect(page.getByTestId("transfer-history-empty")).toHaveCount(0);
    });

    test("destination can come from the address book", async ({ page }) => {
      await page.goto("/send");
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: "Address book" }).first().click();
      await page.getByText("Demo Wallet").click();
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toHaveValue(
        "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
      );
    });
  });

  test.describe("negative", () => {
    test("a transfer the network rejects ends as failed — USDX did not move, safe to send again", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00", transferOutcome: "DROPPED" });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();

      const result = page.getByTestId("transfer-result");
      await expect(result.getByText("Sent — waiting for confirmation")).toBeVisible({ timeout: 15000 });
      await expect(result.getByTestId("transfer-status")).toHaveAttribute("data-status", "FAILED", {
        timeout: 15000,
      });
      await expect(result.getByText("Your USDX did not move. It's safe to send again.")).toBeVisible();
      await expect(result.getByTestId("transfer-failure-reason")).toHaveText(
        "Replaced by another transaction from the same wallet",
      );
      await expect(result.getByText(/successful/i)).toHaveCount(0);
    });

    test("transfer over the per-transaction limit → the limit is named, not a generic error", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00", transferLimit: { perTx: "10.00" } });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });

      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-error")).toContainText(
        "exceeds the per-transaction limit of 10 USDX",
        { timeout: 15000 },
      );
      await expect(page.getByTestId("transfer-result")).toHaveCount(0);
    });

    test("429 RATE_LIMITED → the throttle toast, and the PIN dialog stays for a same-key retry", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await seedRateLimit(page, 3); // every mint/redeem/transfer call → 429 RATE_LIMITED
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByText("Too many requests, please try again shortly.")).toBeVisible({
        timeout: 15000,
      });
      await expect(pin).toBeVisible();
      await expect(page.getByTestId("transfer-result")).toHaveCount(0);
    });

    test("amount above the balance is rejected before anything is sent", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "20.00" });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      await page.goto("/send");
      await expect(page.getByTestId("transfer-balance")).toHaveText("20 USDX", { timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("25");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(TO);
      await expect(page.getByText("The amount exceeds your USDX balance")).toBeVisible();
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    });

    test("PROVISIONING wallet: sending is closed and says why", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "PROVISIONING" });
      await loginViaStorage(page, {
        custodialWallet: { address: null, status: "PROVISIONING" },
      });
      await page.goto("/send");
      await expect(page.getByTestId("transfer-wallet-blocked")).toContainText("still being set up", {
        timeout: 15000,
      });
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    });
  });

  test.describe("edge case", () => {
    test("a user without a custodial wallet still gets the Coming Soon page", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/send");
      // The ComingSoon surface draws the pill twice on purpose (page header +
      // card, Figma `20` Arah 3) — assert on the first, like sidebar-nav.spec.
      await expect(
        page.getByRole("main").getByText("Coming soon", { exact: true }).first(),
      ).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("You will send")).toHaveCount(0);
    });

    test("a transfer stuck in PENDING stays 'waiting' — age never turns it into failed", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00", transferOutcome: "PENDING" });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();

      const result = page.getByTestId("transfer-result");
      await expect(result).toBeVisible({ timeout: 15000 });
      // Well past the mock watcher's 3.5 s and several 3 s polls.
      await page.waitForTimeout(8_000);
      await expect(result.getByTestId("transfer-status")).toHaveAttribute("data-status", "PENDING");
      await expect(result.getByText("Sent — waiting for confirmation")).toBeVisible();
      await expect(result.getByRole("link", { name: "View on explorer" })).toBeVisible();
    });

    test("a transfer still in progress is retried with the same key and completes", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00", slowFirstTransfer: true });
      await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      const pin = await openPinDialog(page);
      await pin.getByLabel("6-digit PIN").fill(MOCK_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 20000 });
      // Exactly one debit: the retry replayed, it did not send twice.
      await page.getByRole("button", { name: "Send another transfer" }).click();
      await expect(page.getByTestId("transfer-balance")).toHaveText("975 USDX", { timeout: 15000 });
      // …and exactly one transfer in the history — one intent, one tracker.
      await page.goto("/send/history");
      await expect(page.getByTestId("transfer-history-row")).toHaveCount(1, { timeout: 15000 });
    });
  });
});
