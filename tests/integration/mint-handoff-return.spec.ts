import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage, forceEnglish } from "../helpers/playwright-utils";

// Returning to /mint after the cross-origin checkout handoff.
//
// The defect the PM reproduced: pay (or abandon) on mint.usdx.co.id, press Back.
// The browser restores /mint from the back-forward cache exactly as it was left —
// Ringkasan modal open, amount + address still filled — and the confirm button is
// live again, so one click creates a SECOND order with a SECOND VA for a mint that
// was already paid.
//
// Two launch tweaks, both required for these specs to test anything at all:
//   - Playwright starts Chromium with `--disable-back-forward-cache`, which would
//     turn every goBack() into a fresh load. Dropped here.
//   - Playwright's default headless binary (chrome-headless-shell) never restores
//     from bfcache either — verified by probe: `notRestoredReasons` comes back
//     populated and `pageshow.persisted` is false. `channel: "chromium"` runs the
//     full Chromium in new headless mode, where the restore is real.
// Both are belt-and-braces to the assertion that actually guards this: every spec
// that claims to test a restore checks `event.persisted` and fails if the browser
// silently gave it a fresh load instead.
test.use({
  channel: "chromium",
  launchOptions: { ignoreDefaultArgs: ["--disable-back-forward-cache"] },
});

// A bfcache restore fires no `load` event (the document never reloads), so the
// default goBack() wait would hang for the full timeout.
const goBack = (page: Page) => page.goBack({ waitUntil: "commit" });

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
const CHECKOUT_ORIGIN = "https://mint.usdx.co.id";

const amountInput = (page: Page) => page.getByPlaceholder("0", { exact: true });
const addressInput = (page: Page) => page.getByPlaceholder("Select destination address");
const summary = (page: Page) => page.getByText("Transaction Summary");

/** Checkout is a separate repo/origin — stub it so the handoff lands somewhere controllable. */
async function stubCheckout(page: Page) {
  await page.route(`${CHECKOUT_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<h1>checkout</h1>" }),
  );
}

/**
 * Record how the page comes back. `persisted: true` means the browser replayed the
 * live page from the back-forward cache — the only path that can resurrect an open
 * modal. A fresh load loses the marker entirely (`null`).
 */
async function armRestoreProbe(page: Page) {
  await page.evaluate(() => {
    (window as Window & { __restored?: boolean }).__restored = undefined;
    window.addEventListener("pageshow", (event) => {
      (window as Window & { __restored?: boolean }).__restored = (
        event as PageTransitionEvent
      ).persisted;
    });
  });
}

async function wasRestoredFromBfcache(page: Page) {
  return page.evaluate(() => (window as Window & { __restored?: boolean }).__restored ?? null);
}

async function fillMintForm(page: Page, amount = "10") {
  await amountInput(page).fill(amount);
  await addressInput(page).fill(VALID_ADDRESS);
}

test.beforeEach(async ({ page }) => {
  await forceEnglish(page);
  await loginViaStorage(page);
  await stubCheckout(page);
  await page.goto("/mint");
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });
});

test.describe("Mint · return from checkout handoff", () => {
  test.describe("positive", () => {
    test("Back from checkout lands on a clean form with the Ringkasan closed", async ({ page }) => {
      await fillMintForm(page, "10");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(summary(page)).toBeVisible();

      await armRestoreProbe(page);
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await page.waitForURL(new RegExp(`^${CHECKOUT_ORIGIN}/checkout/mint_`), { timeout: 15000 });

      await goBack(page);
      await expect(page).toHaveURL(/\/mint$/);

      // Prove the browser really replayed the cached page — otherwise this spec
      // would pass on a fresh load and prove nothing about the defect.
      expect(await wasRestoredFromBfcache(page)).toBe(true);

      await expect(summary(page)).toBeHidden(); // modal-open-after-back
      await expect(amountInput(page)).toHaveValue(""); // form-still-filled-after-back
      await expect(addressInput(page)).toHaveValue("");
      // A cleared form means the one-click path to a duplicate order is gone.
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });

    test("the cleaned form is usable again for a genuinely new mint", async ({ page }) => {
      await fillMintForm(page, "10");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await page.waitForURL(new RegExp(`^${CHECKOUT_ORIGIN}/checkout/mint_`), { timeout: 15000 });
      await goBack(page);

      await fillMintForm(page, "25");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(summary(page)).toBeVisible();
      await expect(page.getByText("25 USDX").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Proceed Payment" })).toBeEnabled();
    });
  });

  test.describe("negative", () => {
    test("a plain tab switch keeps the half-filled form and the open Ringkasan", async ({
      page,
      context,
    }) => {
      await fillMintForm(page, "10");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(summary(page)).toBeVisible();

      const otherTab = await context.newPage();
      await otherTab.goto("about:blank");
      await otherTab.bringToFront();
      await page.bringToFront();
      await otherTab.close();

      await expect(summary(page)).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(amountInput(page)).toHaveValue("10");
      await expect(addressInput(page)).toHaveValue(VALID_ADDRESS);
    });

    test("Back from an external page with no handoff keeps the form", async ({ page }) => {
      // Same bfcache restore, no order created. Nothing was paid, so nothing may
      // be thrown away — this is the line the reset must not cross.
      await fillMintForm(page, "10");
      await armRestoreProbe(page);

      await page.goto(`${CHECKOUT_ORIGIN}/some-other-page`);
      await goBack(page);
      await expect(page).toHaveURL(/\/mint$/);

      expect(await wasRestoredFromBfcache(page)).toBe(true);
      await expect(amountInput(page)).toHaveValue("10");
      await expect(addressInput(page)).toHaveValue(VALID_ADDRESS);
    });
  });

  test.describe("edge cases", () => {
    test("reloading /mint after a handoff also starts clean", async ({ page }) => {
      // bfcache eviction / Cmd-R: a fresh load rebuilds the store empty. Guards the
      // fresh-load half of the fix (the store must never be persisted).
      await fillMintForm(page, "10");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await page.getByRole("button", { name: "Proceed Payment" }).click();
      await page.waitForURL(new RegExp(`^${CHECKOUT_ORIGIN}/checkout/mint_`), { timeout: 15000 });

      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });

      await expect(summary(page)).toBeHidden();
      await expect(amountInput(page)).toHaveValue("");
      await expect(addressInput(page)).toHaveValue("");
    });

    test("confirm stays dead once the handoff is issued, even if the redirect never lands", async ({
      page,
    }) => {
      // The other half of the duplicate-order hazard, no Back involved: the create
      // mutation settles the moment onSuccess returns, while the browser is still
      // navigating. Without the sticky latch the button flips back to a live
      // "Proceed Payment" in that gap and a click there buys the same mint twice.
      // Answering the redirect with 204 pins the page in that exact window: the
      // browser abandons the navigation and stays on /mint with the old document
      // live — no error page, no reload. It doubles as the checkout-unreachable
      // case, where failing closed is the safe answer (the order already exists;
      // the way out is reloading /mint, not creating a second one).
      let redirectIssued!: () => void;
      const navigationStarted = new Promise<void>((resolve) => {
        redirectIssued = resolve;
      });
      await page.route(`${CHECKOUT_ORIGIN}/checkout/**`, async (route) => {
        redirectIssued();
        await route.fulfill({ status: 204 });
      });

      await fillMintForm(page, "10");
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await page.getByRole("button", { name: "Proceed Payment" }).click();

      await navigationStarted; // redirect issued → the create mutation is done
      await page.waitForTimeout(500); // and its settled state has reached React

      await expect(page).toHaveURL(/\/mint$/);
      await expect(page.getByRole("button", { name: "Processing..." })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Proceed Payment" })).toHaveCount(0);
    });
  });
});
