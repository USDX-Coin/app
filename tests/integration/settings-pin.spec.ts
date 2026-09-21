import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  seedAccountPin,
  seedCustodialWallet,
  seedStrictPinSet,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
  MOCK_PIN,
  VIEWPORTS,
} from "../helpers/playwright-utils";

// Pengaturan → Akun → PIN transaksi (USDX-651, pin.yaml § set / change). Runs
// against the mock backend: the account PIN lives in the "usdx-mock-pin" seam
// (`seedAccountPin`), so a PIN created here is the PIN the transfer dialog on
// /send verifies on the next page load — which is the whole point of the ticket.
//
// What these pin, per the ACs: a user without a PIN creates one from Settings
// and uses it right away (no re-login, no /auth/me round trip); changing needs
// the current PIN and a wrong one changes nothing; the shared lockout is shown
// as a countdown; the copy reads in both languages without jargon.

const NEW_PIN = "654321";
const pinRow = (page: Page) => page.locator('[data-slot="settings-pin"]');

async function gotoSettings(page: Page, heading = "Settings") {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 15000 });
}

async function openChange(page: Page) {
  await pinRow(page).getByRole("button", { name: "Change PIN" }).click();
  const dialog = page.getByTestId("pin-change-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillChange(dialog: ReturnType<Page["getByTestId"]>, current: string, next = NEW_PIN) {
  await dialog.getByLabel("Current PIN", { exact: true }).fill(current);
  await dialog.getByLabel("New PIN", { exact: true }).fill(next);
  await dialog.getByLabel("Repeat new PIN", { exact: true }).fill(next);
  await dialog.getByRole("button", { name: "Change PIN" }).click();
}

test.describe("Settings — transaction PIN", () => {
  test.describe("positive", () => {
    test("a user without a PIN creates one from Settings and approves a transfer with it right away", async ({
      page,
    }) => {
      await forceEnglish(page);
      await seedAccountPin(page, null);
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await loginViaStorage(page, { pinSet: false, custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      await gotoSettings(page);

      const row = pinRow(page);
      await expect(row.getByText("No PIN yet")).toBeVisible();
      await row.getByRole("button", { name: "Create PIN" }).click();

      const dialog = page.getByTestId("pin-setup-dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("New PIN", { exact: true }).fill(NEW_PIN);
      await dialog.getByLabel("Repeat PIN", { exact: true }).fill(NEW_PIN);
      await dialog.getByRole("button", { name: "Create PIN" }).click();

      await expect(page.getByText("PIN created. You can use it right away.")).toBeVisible();
      await expect(dialog).toBeHidden();
      // The row follows the store copy at once — no reload, no /auth/me wait.
      await expect(row.getByText("PIN set")).toBeVisible();
      await expect(row.getByRole("button", { name: "Change PIN" })).toBeVisible();

      // The PIN just created is the one the money path verifies.
      await page.goto("/send");
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("25");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill("0xabcdef1234567890abcdef1234567890abcdef12");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByRole("button", { name: "Continue to PIN" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await pin.getByLabel("6-digit PIN").fill(NEW_PIN);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });

    test("an existing PIN is changed with the current PIN", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await gotoSettings(page);

      await expect(pinRow(page).getByText("PIN set")).toBeVisible();
      const dialog = await openChange(page);
      await fillChange(dialog, MOCK_PIN);

      await expect(page.getByText("PIN changed.")).toBeVisible();
      await expect(dialog).toBeHidden();
    });
  });

  test.describe("negative", () => {
    test("wrong current PIN → a clear message on that field, the new PIN kept, nothing changed", async ({
      page,
    }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await gotoSettings(page);

      const dialog = await openChange(page);
      await fillChange(dialog, "000000");

      await expect(dialog.getByText("Wrong PIN. Please try again.")).toBeVisible({ timeout: 10000 });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("New PIN", { exact: true })).toHaveValue(NEW_PIN);

      // Nothing changed: the original PIN still opens the change.
      await dialog.getByLabel("Current PIN", { exact: true }).fill(MOCK_PIN);
      await dialog.getByRole("button", { name: "Change PIN" }).click();
      await expect(page.getByText("PIN changed.")).toBeVisible();
    });

    test("a repeat that does not match → inline error, the dialog stays", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await gotoSettings(page);

      const dialog = await openChange(page);
      await dialog.getByLabel("Current PIN", { exact: true }).fill(MOCK_PIN);
      await dialog.getByLabel("New PIN", { exact: true }).fill(NEW_PIN);
      await dialog.getByLabel("Repeat new PIN", { exact: true }).fill("654322");
      await dialog.getByRole("button", { name: "Change PIN" }).click();

      await expect(dialog.getByText("The PINs do not match.")).toBeVisible();
      await expect(page.getByText("PIN changed.")).toHaveCount(0);
    });
  });

  test.describe("edge case", () => {
    test("five wrong current PINs → the lockout shows as a 15-minute countdown on the button", async ({
      page,
    }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await gotoSettings(page);

      const dialog = await openChange(page);
      for (let i = 0; i < 5; i++) {
        await fillChange(dialog, "000000");
        await expect(dialog.getByText("Wrong PIN. Please try again.")).toBeVisible({ timeout: 10000 });
      }
      // The sixth attempt is refused with 429 + Retry-After 900 (shared `pin` scope).
      await fillChange(dialog, MOCK_PIN);
      await expect(dialog.getByRole("button", { name: /Try again in 15 minutes/ })).toBeDisabled({
        timeout: 10000,
      });
    });

    test("reads in Indonesian without jargon, and works on a 375px viewport", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await forceIndonesian(page);
      await seedAccountPin(page, null);
      await loginViaStorage(page, { pinSet: false });
      await gotoSettings(page, "Pengaturan");

      const row = pinRow(page);
      await expect(row.getByText("PIN transaksi")).toBeVisible();
      await expect(row.getByText("Belum punya PIN")).toBeVisible();
      await expect(row.getByText(/custodial|private key/i)).toHaveCount(0);
      await row.getByRole("button", { name: "Buat PIN" }).click();

      const dialog = page.getByTestId("pin-setup-dialog");
      await expect(dialog.getByRole("heading", { name: "Buat PIN" })).toBeVisible();
      await dialog.getByLabel("PIN baru", { exact: true }).fill(NEW_PIN);
      await dialog.getByLabel("Ulangi PIN", { exact: true }).fill(NEW_PIN);
      await dialog.getByRole("button", { name: "Buat PIN" }).click();
      await expect(page.getByText("PIN dibuat. Bisa langsung dipakai.")).toBeVisible();
      await expect(row.getByText("PIN sudah dibuat")).toBeVisible();
    });
  });
});

// First-time PIN on an account that already has a custodial wallet, against the
// backend of USDX-698 (pin.yaml § set, keputusan PM 21 Sep 2026; USDX-697): the
// session must be a fresh password-auth one. `loginViaStorage` never logs in
// through the mock, so it plays the stale session — 401 REAUTH_REQUIRED with
// `details.pinSet: false`. The way out is "Log in again": the login form, then
// straight back to this dialog on Settings.
async function tryCreate(page: Page, pin = NEW_PIN) {
  const dialog = page.getByTestId("pin-setup-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("New PIN", { exact: true }).fill(pin);
  await dialog.getByLabel("Repeat PIN", { exact: true }).fill(pin);
  await dialog.getByRole("button", { name: "Create PIN" }).click();
  return dialog;
}

async function loginThroughForm(page: Page) {
  await expect(page).toHaveURL(/\/login/);
  await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("Enter your password").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
}

test.describe("Settings — create PIN needs a fresh login (backend USDX-698)", () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglish(page);
    await seedStrictPinSet(page);
    await seedAccountPin(page, null);
  });

  test.describe("positive", () => {
    test("stale session → log in again → back on Settings with Create PIN open → the PIN is created", async ({
      page,
    }) => {
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await loginViaStorage(page, { pinSet: false, custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      await gotoSettings(page);
      await pinRow(page).getByRole("button", { name: "Create PIN" }).click();

      const dialog = await tryCreate(page);
      const error = dialog.getByTestId("pin-setup-error");
      await expect(error).toContainText("For your security, log in again first, then create your PIN within 5 minutes.");
      await expect(error).not.toContainText("Change PIN");
      // The copy stays "no PIN" — never flipped to "PIN set" / "Change PIN".
      await expect(pinRow(page).getByText("No PIN yet")).toBeVisible();

      await error.getByRole("button", { name: "Log in again" }).click();
      await loginThroughForm(page);

      await expect(page).toHaveURL(/\/settings$/, { timeout: 15000 });
      await tryCreate(page);
      await expect(page.getByText("PIN created. You can use it right away.")).toBeVisible();
      await expect(pinRow(page).getByText("PIN set")).toBeVisible();
    });
  });

  test.describe("negative", () => {
    test("no custodial wallet → the gate does not apply: the PIN is created on the stale session", async ({
      page,
    }) => {
      await loginViaStorage(page, { pinSet: false });
      await gotoSettings(page);
      await pinRow(page).getByRole("button", { name: "Create PIN" }).click();

      await tryCreate(page);
      await expect(page.getByText("PIN created. You can use it right away.")).toBeVisible();
    });
  });

  test.describe("edge case", () => {
    test("the landing marker is used once: after the re-login, a reload of Settings opens no dialog", async ({
      page,
    }) => {
      await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
      await loginViaStorage(page, { pinSet: false, custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
      await gotoSettings(page);
      await pinRow(page).getByRole("button", { name: "Create PIN" }).click();
      const dialog = await tryCreate(page);
      await dialog.getByRole("button", { name: "Log in again" }).click();

      // Per tab, and only the intent name — never the PIN just typed.
      expect(await page.evaluate(() => sessionStorage.getItem("usdx-relogin-intent"))).toBe("create-pin");
      await loginThroughForm(page);
      await expect(page.getByTestId("pin-setup-dialog")).toBeVisible({ timeout: 15000 });
      expect(await page.evaluate(() => sessionStorage.getItem("usdx-relogin-intent"))).toBeNull();

      await page.reload();
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("pin-setup-dialog")).toHaveCount(0);
    });
  });
});
