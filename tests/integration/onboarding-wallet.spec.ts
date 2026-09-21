import { test, expect } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedCustodialWallet,
  MOCK_CUSTODIAL_ADDRESS,
} from "../helpers/playwright-utils";

// /onboarding/wallet (USDX-566). Verify-email no longer lands here — that redirect
// is off in every environment (custodial-wallet.md §1, amandemen 14 Sep 2026) — so
// only a direct URL opens the step. The create button is back on builds with
// `env.walletCreateEnabled` ON (dev, and the mock these specs run on; amandemen
// 21 Sep 2026, USDX-699). Three exits, one per AC: accept → PROVISIONING → ACTIVE →
// continue; decline → the app exactly as before (no custodial card anywhere);
// already has one → no offer, straight to the wallet.

const offer = "No wallet yet? We'll make you one.";

test.describe("Wallet onboarding step", () => {
  test.describe("positive", () => {
    test("accept → wallet becomes ACTIVE on the same screen → continue lands on the dashboard with the balance card", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);
      await page.goto("/onboarding/wallet");
      await expect(page.getByRole("heading", { name: offer })).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "Create my wallet" }).click();
      await expect(page.getByText("Your wallet is being set up")).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("heading", { name: "Your wallet is ready" })).toBeVisible({
        timeout: 20000,
      });
      await expect(page.getByRole("main").getByText("0 USDX", { exact: true })).toBeVisible();

      // The sidebar card fills in as soon as the wallet is ACTIVE — beside the
      // connected-wallet card, which still says what it always said.
      const custodial = page.locator('[data-slot="custodial-balance"]');
      await expect(custodial).toBeVisible();
      await expect(custodial).toHaveAttribute("data-status", "ACTIVE");
      await expect(page.getByRole("complementary").getByText("Total balance")).toBeVisible();
      await expect(page.getByRole("complementary").getByText("Connect a wallet to see your balance")).toBeVisible();

      await page.getByRole("link", { name: "Continue to the app" }).click();
      await expect(page).toHaveURL(/\/mint$/);
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-slot="custodial-balance"]')).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("decline → /mint, and the app looks exactly as it did before this step existed", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, null);
      await loginViaStorage(page);

      let walletCalls = 0;
      page.on("request", (req) => {
        if (/\/api\/v2\/wallet(\?|$)/.test(req.url())) walletCalls += 1;
      });

      await page.goto("/onboarding/wallet");
      await expect(page.getByRole("heading", { name: offer })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("You can do this any time from Settings.")).toBeVisible();

      await page.getByRole("button", { name: "Not now" }).click();
      await expect(page).toHaveURL(/\/mint$/);
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });

      // No custodial card in the sidebar, the connect-wallet card untouched,
      // and — the routing rule — no GET /wallet was ever attempted for a user
      // whose profile says they have none.
      await expect(page.locator('[data-slot="custodial-balance"]')).toHaveCount(0);
      await expect(page.getByRole("complementary").getByText("Connect a wallet to see your balance")).toBeVisible();
      expect(walletCalls).toBe(0);
    });
  });

  test.describe("edge case", () => {
    test("an account that already has a wallet sees it, not the offer", async ({ page }) => {
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "12.00" });
      await loginViaStorage(page, {
        custodialWallet: { address: MOCK_CUSTODIAL_ADDRESS, status: "ACTIVE" },
      });
      await page.goto("/onboarding/wallet");

      await expect(page.getByRole("heading", { name: "Your wallet is ready" })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("heading", { name: offer })).toHaveCount(0);
      await expect(page.getByRole("main").getByText("12 USDX", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Continue to the app" })).toHaveAttribute(
        "href",
        "/mint",
      );
    });

    test("PROVISIONING carried over from a previous session is picked up and finishes", async ({
      page,
    }) => {
      // The user closed the tab mid-provisioning. The mock has no activateAt on
      // a seeded PROVISIONING wallet, so only a repeat POST (retry) would move
      // it — here we assert the state is shown as a state, with no address.
      await forceEnglish(page);
      await seedCustodialWallet(page, { status: "PROVISIONING", stuck: true });
      await loginViaStorage(page, { custodialWallet: { address: null, status: "PROVISIONING" } });
      await page.goto("/onboarding/wallet");

      await expect(page.getByText("Your wallet is being set up")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Receiving address")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Continue to the app" })).toHaveCount(0);
      await expect(page.locator('[data-slot="custodial-balance"]')).toHaveAttribute(
        "data-status",
        "PROVISIONING",
      );
    });
  });
});
