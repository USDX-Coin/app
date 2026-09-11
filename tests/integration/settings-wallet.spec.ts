import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  seedCustodialWallet,
  seedCustodialPollBudget,
  seedCustodialCreateFailure,
  MOCK_CUSTODIAL_ADDRESS,
} from "../helpers/playwright-utils";

// Pengaturan → Wallet USDX (USDX-566). Runs against the mock backend via the
// localStorage seams: the mock keeps the wallet in "usdx-mock-custodial", so a
// state seeded before the first page load is what GET /api/v2/wallet answers.
//
// What these pin, per the ticket's ACs: an existing user activates from
// Settings and ends up ACTIVE with a real 0 balance; PROVISIONING is shown as a
// state, not a spinner without end; the poll gives up and offers "try again",
// and that retry (a repeat POST) is what heals a stuck wallet; a null balance is
// "—", never 0; the address is gated on ACTIVE.

const ACTIVE_SUMMARY = { address: MOCK_CUSTODIAL_ADDRESS, status: "ACTIVE" as const };
const walletCard = (page: Page) => page.locator('[data-slot="settings-wallet"]');

async function gotoSettings(page: Page) {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15000 });
}

test.describe("Settings — custodial wallet", () => {
  test.describe("positive", () => {
    test("an existing user without a wallet sees the offer and can activate it to ACTIVE with balance 0", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);
      await gotoSettings(page);

      const card = walletCard(page);
      await expect(card.getByText("No wallet yet? We'll make you one.")).toBeVisible();
      // Settings has no "Not now": there is nothing to skip to.
      await expect(card.getByRole("button", { name: "Not now" })).toHaveCount(0);

      await card.getByRole("button", { name: "Create my wallet" }).click();

      // PROVISIONING is a named state on screen, not an endless spinner.
      await expect(card.getByText("Your wallet is being set up")).toBeVisible({ timeout: 10000 });
      await expect(card.locator('[data-status="PROVISIONING"]').first()).toBeVisible();

      // The mock flips to ACTIVE ~1.5 s later; polling picks it up.
      await expect(card.getByText("Receiving address")).toBeVisible({ timeout: 20000 });
      await expect(card.locator('[data-slot="wallet-balance"]')).toHaveText("0 USDX");
      await expect(card.locator('[data-slot="wallet-balance"]')).toHaveAttribute("data-known", "true");
      await expect(card.locator('[data-status="ACTIVE"]').first()).toBeVisible();
      await expect(card.getByRole("img", { name: "QR code of the receiving address" })).toBeVisible();
      await expect(card.getByText("This wallet is managed by USDX")).toBeVisible();
    });

    test("a user who already has a wallet sees address, status and the live balance", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "125.50" });
      await loginViaStorage(page, { custodialWallet: ACTIVE_SUMMARY });
      await gotoSettings(page);

      const card = walletCard(page);
      await expect(card.locator('[data-slot="wallet-balance"]')).toHaveText("125.5 USDX", {
        timeout: 15000,
      });
      await expect(card.getByText(/^as of /)).toBeVisible();
      await expect(card.getByText("No wallet yet?")).toHaveCount(0);
    });

    test("the address is shown shortened, with copy and a toggle for the full 42 characters", async ({
      page,
      context,
    }) => {
      // Headless Chromium rejects clipboard writes unless the permission is
      // granted up front; a real browser on a secure origin just allows it.
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE" });
      await loginViaStorage(page, { custodialWallet: ACTIVE_SUMMARY });
      await gotoSettings(page);

      const card = walletCard(page);
      const value = card.locator('[data-slot="receive-address-value"]');
      await expect(value).toHaveText("0x000000...3c9aFf", { timeout: 15000 });

      await card.getByRole("button", { name: "Show full address" }).click();
      await expect(value).toHaveText(MOCK_CUSTODIAL_ADDRESS);
      await card.getByRole("button", { name: "Hide full address" }).click();
      await expect(value).toHaveText("0x000000...3c9aFf");

      await card.getByRole("button", { name: "Copy address" }).click();
      await expect(card.getByRole("button", { name: "Address copied" })).toBeVisible();
      // What was copied is the full address, not the shortened display form.
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(MOCK_CUSTODIAL_ADDRESS);
    });
  });

  test.describe("negative", () => {
    test("a balance the backend could not read is shown as — and never as 0", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: null });
      await loginViaStorage(page, { custodialWallet: ACTIVE_SUMMARY });
      await gotoSettings(page);

      const card = walletCard(page);
      const balance = card.locator('[data-slot="wallet-balance"]');
      await expect(balance).toHaveText("— USDX", { timeout: 15000 });
      await expect(balance).toHaveAttribute("data-known", "false");
      await expect(card.getByText("Balance could not be read right now.")).toBeVisible();
      // The address is still there: status came from the working copy, only
      // the number was unreadable.
      await expect(card.getByText("Receiving address")).toBeVisible();
      await expect(card.getByText("0 USDX", { exact: true })).toHaveCount(0);
    });

    test("503 from POST /wallet is a friendly sentence, the offer stays, and the second try succeeds", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await seedCustodialCreateFailure(page);
      await loginViaStorage(page);
      await gotoSettings(page);

      const card = walletCard(page);
      await card.getByRole("button", { name: "Create my wallet" }).click();

      // Our sentence, with the one reassurance that matters — nothing changed.
      await expect(card.getByText("The wallet service is unavailable right now")).toBeVisible({
        timeout: 10000,
      });
      await expect(card.getByText("Nothing was changed")).toBeVisible();
      await expect(card.getByRole("button", { name: "Create my wallet" })).toBeEnabled();

      // Retry: the seam has disarmed, so this one goes through to ACTIVE.
      await card.getByRole("button", { name: "Create my wallet" }).click();
      await expect(card.getByText("Receiving address")).toBeVisible({ timeout: 20000 });
    });

    test("a SUSPENDED wallet explains itself and shows no receiving address", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "SUSPENDED" });
      await loginViaStorage(page, { custodialWallet: { ...ACTIVE_SUMMARY, status: "SUSPENDED" } });
      await gotoSettings(page);

      const card = walletCard(page);
      await expect(card.getByText("Wallet suspended")).toBeVisible({ timeout: 15000 });
      await expect(card.getByText("paused by the USDX team")).toBeVisible();
      await expect(card.getByText("Receiving address")).toHaveCount(0);
      await expect(card.getByRole("button", { name: "Create my wallet" })).toHaveCount(0);
    });
  });

  test.describe("edge cases", () => {
    test("provisioning that outlasts the poll window shows 'still being set up' + try again, and the retry heals it", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "PROVISIONING", stuck: true });
      // Longer than one poll interval (3 s) + the mock's activation delay
      // (1.5 s): the retry opens a NEW window, and the first poll inside it must
      // still be able to observe ACTIVE. Shorter than that and the window would
      // close before the poll ever fires — the same rule the production
      // constants keep with 60 s over 3 s.
      await seedCustodialPollBudget(page, 5000);
      await loginViaStorage(page, { custodialWallet: { address: null, status: "PROVISIONING" } });
      await gotoSettings(page);

      const card = walletCard(page);
      await expect(card.getByText("Still being set up")).toBeVisible({ timeout: 15000 });
      await expect(card.getByText("never creates a second wallet")).toBeVisible();
      // No address, no QR while PROVISIONING — the receive screen is gated on ACTIVE.
      await expect(card.getByText("Receiving address")).toHaveCount(0);

      // "Try again" = POST again (202, not 409). In the mock that is also what
      // un-sticks the wallet — exactly the §5.5 healing path.
      await card.getByRole("button", { name: "Try again" }).click();
      await expect(card.getByText("Receiving address")).toBeVisible({ timeout: 20000 });
      await expect(card.locator('[data-slot="wallet-balance"]')).toHaveText("0 USDX");
    });

    test("the offer and the wallet read in Indonesian, without jargon", async ({ page }) => {
      await forceIndonesian(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Pengaturan" })).toBeVisible({
        timeout: 15000,
      });

      const card = walletCard(page);
      await expect(card.getByText("Belum punya wallet? Kami buatkan.")).toBeVisible();
      await card.getByRole("button", { name: "Buatkan saya wallet" }).click();
      await expect(card.getByText("Wallet kamu sedang disiapkan")).toBeVisible({ timeout: 10000 });
      await expect(card.getByText("Alamat penerimaan")).toBeVisible({ timeout: 20000 });
      await expect(card.getByRole("button", { name: "Salin alamat" })).toBeVisible();
      // None of these words are ever on this screen (ticket § Copy UX).
      await expect(card.getByText(/private key|gas|custodial/i)).toHaveCount(0);
    });
  });
});
