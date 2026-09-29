import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedAccountPin,
  seedCustodialWallet,
  seedFreshPasswordAuth,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
  seedTwoFactor,
  MOCK_TOTP_CODE,
} from "../helpers/playwright-utils";

// Create the PIN from inside the money paths (USDX-651). A custodial-wallet
// owner without a PIN reaches the Ringkasan of a transfer / a custodial redeem,
// sees the "no PIN yet" notice, creates the PIN right there, and approves the
// same transaction with it — without leaving the flow or logging in again
// (the session is fresh: the flow starts right after a login, USDX-698).
// The account PIN is the "usdx-mock-pin" seam; `pinSet: false` on the profile
// copy is what the screens read first.
const NEW_PIN = "654321";
const TO = "0xabcdef1234567890abcdef1234567890abcdef12";

async function createPinFromNotice(page: Page, notice: ReturnType<Page["getByTestId"]>) {
  await expect(notice).toContainText("no PIN yet");
  await expect(notice).not.toContainText(/custodial/i);
  await notice.getByRole("button", { name: "Create PIN" }).click();
  const setup = page.getByTestId("pin-setup-dialog");
  await expect(setup).toBeVisible();
  await setup.getByLabel("New PIN", { exact: true }).fill(NEW_PIN);
  await setup.getByLabel("Repeat PIN", { exact: true }).fill(NEW_PIN);
  await setup.getByRole("button", { name: "Create PIN" }).click();
  await expect(page.getByText("PIN created. You can use it right away.")).toBeVisible();
  await expect(setup).toBeHidden();
  await expect(notice).toHaveCount(0);
}

// A custodial owner whose account has no PIN, as the profile copy already knows.
async function loginWithoutPin(page: Page) {
  await seedAccountPin(page, null);
  await loginViaStorage(page, { pinSet: false, custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY, twoFactorEnabled: true });
}

test.describe("PIN Flow (create from the money paths)", () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglish(page);
    await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
    await seedTwoFactor(page, true); // 2FA wajib uang keluar custodial (USDX-717)
    // Right after a login: since USDX-698 a wallet owner creates a first PIN only
    // on a fresh session (the stale-session door is the "PIN Flow (create PIN
    // needs a fresh login)" block below).
    await seedFreshPasswordAuth(page);
  });

  test.describe("positive", () => {
    test("transfer: the Ringkasan notice creates the PIN in place, then the transfer goes through with it", async ({
      page,
    }) => {
      await loginWithoutPin(page);
      await page.goto("/send");
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("25");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(TO);
      await page.getByRole("button", { name: "Send", exact: true }).click();

      const summary = page.getByRole("dialog").filter({ hasText: "Transaction Summary" });
      await expect(summary).toBeVisible();
      // No PIN on the account: the step is closed, and the way out is on the notice.
      await expect(summary.getByRole("button", { name: "Continue to PIN" })).toBeDisabled();
      await createPinFromNotice(page, page.getByTestId("transfer-pin-not-set"));

      // The same transfer, not a new one: the Ringkasan is still open with its figures.
      await expect(summary).toBeVisible();
      await expect(summary.getByText("25 USDX")).toBeVisible();
      await summary.getByRole("button", { name: "Continue to PIN" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await pin.getByLabel("6-digit PIN").fill(NEW_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });

    test("redeem (custodial source): the notice creates the PIN, then Continue to Confirmation opens the PIN dialog", async ({
      page,
    }) => {
      await loginWithoutPin(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByRole("combobox", { name: "Select bank" }).click();
      await page.getByText("BCA", { exact: true }).click();
      await page.getByPlaceholder("1234567890").fill("1234563210");
      await page.getByPlaceholder("As printed on the passbook").fill("SINGGIH BRILIAN TARA");
      await page.getByRole("button", { name: "Redeem", exact: true }).click();

      const summary = page.getByRole("dialog").filter({ hasText: "Transaction Summary" });
      await expect(summary).toBeVisible();
      await expect(summary.getByRole("button", { name: "Continue to Confirmation" })).toBeDisabled();
      await createPinFromNotice(page, page.getByTestId("redeem-pin-not-set"));

      await summary.getByRole("button", { name: "Continue to Confirmation" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await expect(pin).toBeVisible();
      await pin.getByLabel("6-digit PIN").fill(NEW_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Confirm & Burn" }).click();
      await expect(page.getByTestId("redeem-custodial-processing")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("the backend's PIN_NOT_SET (stale profile copy) switches the PIN dialog to the notice, and creating the PIN reopens the input", async ({
      page,
    }) => {
      // The profile copy and /auth/me both say there is a PIN, so the PIN dialog
      // opens normally. The PIN is then removed underneath the open dialog (the
      // mock is told after the fact): the attempt is answered 401 PIN_NOT_SET and
      // the copy is corrected on the spot.
      await loginViaStorage(page, { pinSet: true, custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY, twoFactorEnabled: true });
      await page.goto("/send");
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("25");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(TO);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByRole("button", { name: "Continue to PIN" }).click();

      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await expect(pin.getByLabel("6-digit PIN")).toBeVisible();
      await page.evaluate(() => localStorage.setItem("usdx-mock-pin", JSON.stringify({ pin: null })));
      await pin.getByLabel("6-digit PIN").fill("111111");
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();

      const notice = page.getByTestId("pin-confirm-not-set");
      await expect(notice).toBeVisible({ timeout: 15000 });
      await expect(pin.getByLabel("6-digit PIN")).toHaveCount(0);
      await createPinFromNotice(page, notice);

      // Back in the same PIN dialog, now with an input — and no stale "no PIN" sentence.
      await expect(pin.getByLabel("6-digit PIN")).toBeVisible();
      await expect(pin.getByText(/no PIN yet/)).toHaveCount(0);
      await pin.getByLabel("6-digit PIN").fill(NEW_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("edge case", () => {
    test("cancelling the create-PIN dialog leaves the transfer where it was, still without a PIN", async ({
      page,
    }) => {
      await loginWithoutPin(page);
      await page.goto("/send");
      await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("25");
      await page.getByPlaceholder("0x5DC489Ad05Efc").fill(TO);
      await page.getByRole("button", { name: "Send", exact: true }).click();

      const notice = page.getByTestId("transfer-pin-not-set");
      await notice.getByRole("button", { name: "Create PIN" }).click();
      const setup = page.getByTestId("pin-setup-dialog");
      await setup.getByRole("button", { name: "Cancel" }).click();
      await expect(setup).toBeHidden();

      await expect(notice).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue to PIN" })).toBeDisabled();
      await expect(page.getByRole("dialog").filter({ hasText: "Transaction Summary" })).toBeVisible();
    });
  });
});

// Against the backend of USDX-698 (pin.yaml § set; USDX-697): the storage-seeded
// session is stale, so creating the PIN from a money path is answered 401
// REAUTH_REQUIRED + `details.pinSet: false`. Every create-PIN door says "log in
// again" — never "use Change PIN" — and the re-login brings the user back to the
// Create PIN dialog, after which the new PIN approves the transfer.
const RELOGIN_SENTENCE = "For your security, log in again first, then create your PIN within 5 minutes.";

async function submitCreatePin(page: Page) {
  const setup = page.getByTestId("pin-setup-dialog");
  await expect(setup).toBeVisible({ timeout: 15000 });
  await setup.getByLabel("New PIN", { exact: true }).fill(NEW_PIN);
  await setup.getByLabel("Repeat PIN", { exact: true }).fill(NEW_PIN);
  await setup.getByRole("button", { name: "Create PIN" }).click();
  return setup;
}

async function expectReloginAsked(page: Page) {
  const error = page.getByTestId("pin-setup-error");
  await expect(error).toContainText(RELOGIN_SENTENCE, { timeout: 10000 });
  await expect(error).not.toContainText("Change PIN");
  return error;
}

async function openTransferSummary(page: Page) {
  await page.goto("/send");
  await expect(page.getByText("You will send")).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("0", { exact: true }).fill("25");
  await page.getByPlaceholder("0x5DC489Ad05Efc").fill(TO);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const summary = page.getByRole("dialog").filter({ hasText: "Transaction Summary" });
  await expect(summary).toBeVisible();
  return summary;
}

test.describe("PIN Flow (create PIN needs a fresh login, backend USDX-698)", () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglish(page);
    await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
    await seedTwoFactor(page, true); // 2FA wajib uang keluar custodial (USDX-717)
  });

  test.describe("positive", () => {
    test("transfer notice → log in again → Create PIN on Settings → the new PIN approves a transfer", async ({
      page,
    }) => {
      await loginWithoutPin(page);
      await openTransferSummary(page);
      await page.getByTestId("transfer-pin-not-set").getByRole("button", { name: "Create PIN" }).click();
      await submitCreatePin(page);
      const error = await expectReloginAsked(page);

      await error.getByRole("button", { name: "Log in again" }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
      await page.getByPlaceholder("Enter your password").fill("Demo1234");
      await page.getByRole("button", { name: "Login" }).click();
      await page.getByLabel("Authenticator code or backup code").fill(MOCK_TOTP_CODE);
      await page.getByRole("button", { name: "Verify & log in" }).click();

      await expect(page).toHaveURL(/\/settings$/, { timeout: 15000 });
      const setup = await submitCreatePin(page);
      await expect(page.getByText("PIN created. You can use it right away.")).toBeVisible();
      await expect(setup).toBeHidden();

      const summary = await openTransferSummary(page);
      await summary.getByRole("button", { name: "Continue to PIN" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await pin.getByLabel("6-digit PIN").fill(NEW_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("redeem notice: the same log-in-again answer, and Continue to Confirmation stays closed", async ({
      page,
    }) => {
      await loginWithoutPin(page);
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByRole("combobox", { name: "Select bank" }).click();
      await page.getByText("BCA", { exact: true }).click();
      await page.getByPlaceholder("1234567890").fill("1234563210");
      await page.getByPlaceholder("As printed on the passbook").fill("SINGGIH BRILIAN TARA");
      await page.getByRole("button", { name: "Redeem", exact: true }).click();

      await page.getByTestId("redeem-pin-not-set").getByRole("button", { name: "Create PIN" }).click();
      await submitCreatePin(page);
      await expectReloginAsked(page);
      // Still no PIN once the dialog is closed: the notice stays, the step stays shut.
      await page.getByTestId("pin-setup-dialog").getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByTestId("redeem-pin-not-set")).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue to Confirmation" })).toBeDisabled();
    });
  });

  test.describe("edge case", () => {
    test("PIN dialog notice (copy said there was a PIN): log in again, the copy is not flipped back to 'has a PIN'", async ({
      page,
    }) => {
      await loginViaStorage(page, { pinSet: true, custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY, twoFactorEnabled: true });
      const summary = await openTransferSummary(page);
      await summary.getByRole("button", { name: "Continue to PIN" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await expect(pin.getByLabel("6-digit PIN")).toBeVisible();
      await page.evaluate(() => localStorage.setItem("usdx-mock-pin", JSON.stringify({ pin: null })));
      await pin.getByLabel("6-digit PIN").fill("111111");
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();

      const notice = page.getByTestId("pin-confirm-not-set");
      await expect(notice).toBeVisible({ timeout: 15000 });
      await notice.getByRole("button", { name: "Create PIN" }).click();
      await submitCreatePin(page);
      await expectReloginAsked(page);
      // The PIN_NOT_SET correction stands: still the notice, still no input.
      await page.getByTestId("pin-setup-dialog").getByRole("button", { name: "Cancel" }).click();
      await expect(notice).toBeVisible();
      await expect(pin.getByLabel("6-digit PIN")).toHaveCount(0);
    });
  });
});

// Forgot PIN from the money paths (custodial-wallet.md §5.1 "Lupa PIN di web",
// USDX-696). The account has the demo PIN `MOCK_PIN` ("123456"); the user has
// forgotten it. "Forgot PIN?" in the PIN dialog → Log in again → Settings with
// "Create a new PIN" open → the new PIN approves the transfer, the old one is
// refused. The login clears the shared `pin` lockout, so a locked-out user gets
// straight back in.
const OLD_PIN = "123456";

async function openTransferPinDialog(page: Page) {
  const summary = await openTransferSummary(page);
  await summary.getByRole("button", { name: "Continue to PIN" }).click();
  const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
  await expect(pin).toBeVisible();
  return pin;
}

async function logInAgainFromForgot(page: Page, pinDialog: ReturnType<Page["getByRole"]>) {
  await pinDialog.getByRole("button", { name: "Forgot PIN?" }).click();
  await page.getByTestId("forgot-pin-dialog").getByRole("button", { name: "Log in again" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("Enter your password").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByLabel("Authenticator code or backup code").fill(MOCK_TOTP_CODE);
  await page.getByRole("button", { name: "Verify & log in" }).click();
  await expect(page).toHaveURL(/\/settings$/, { timeout: 15000 });
}

test.describe("PIN Flow (forgot PIN from the money paths, USDX-696)", () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglish(page);
    await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
    await seedTwoFactor(page, true); // 2FA wajib uang keluar custodial (USDX-717)
    await loginViaStorage(page, { custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY, twoFactorEnabled: true });
  });

  test.describe("positive", () => {
    test("locked out in the transfer PIN dialog → Forgot PIN? → log in again → new PIN → the countdown is gone and the new PIN approves the transfer", async ({
      page,
    }) => {
      const pin = await openTransferPinDialog(page);
      for (let i = 0; i < 5; i++) {
        await pin.getByLabel("6-digit PIN").fill("000000");
        await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
        await pin.getByRole("button", { name: "Send", exact: true }).click();
        await expect(pin.getByText("Wrong PIN. Please try again.")).toBeVisible({ timeout: 10000 });
      }
      await pin.getByLabel("6-digit PIN").fill(OLD_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(pin.getByText(/Too many wrong attempts/)).toBeVisible({ timeout: 10000 });

      await logInAgainFromForgot(page, pin);
      const setup = page.getByTestId("pin-setup-dialog");
      await expect(setup.getByRole("heading", { name: "Create a new PIN" })).toBeVisible({ timeout: 15000 });
      await setup.getByLabel("New PIN", { exact: true }).fill(NEW_PIN);
      await setup.getByLabel("Repeat PIN", { exact: true }).fill(NEW_PIN);
      await setup.getByRole("button", { name: "Save new PIN" }).click();
      await expect(page.getByText("New PIN saved. Your old PIN no longer works.")).toBeVisible();

      const again = await openTransferPinDialog(page);
      await expect(again.getByText(/Too many wrong attempts/)).toHaveCount(0);
      await again.getByLabel("6-digit PIN").fill(OLD_PIN);
      await again.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await again.getByRole("button", { name: "Send", exact: true }).click();
      await expect(again.getByText("Wrong PIN. Please try again.")).toBeVisible({ timeout: 10000 });
      await again.getByLabel("6-digit PIN").fill(NEW_PIN);
      await again.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await again.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("negative", () => {
    test("Cancel on the log-in-again step keeps the transfer where it was; the old PIN still approves it", async ({
      page,
    }) => {
      const pin = await openTransferPinDialog(page);
      await pin.getByRole("button", { name: "Forgot PIN?" }).click();
      const forgot = page.getByTestId("forgot-pin-dialog");
      await forgot.getByRole("button", { name: "Cancel" }).click();
      await expect(forgot).toBeHidden();
      expect(await page.evaluate(() => sessionStorage.getItem("usdx-relogin-intent"))).toBeNull();

      await expect(pin).toBeVisible();
      await pin.getByLabel("6-digit PIN").fill(OLD_PIN);
      await pin.getByLabel("Authenticator code").fill(MOCK_TOTP_CODE);
      await pin.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByTestId("transfer-result")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("edge case", () => {
    test("the custodial redeem PIN dialog has the same door", async ({ page }) => {
      await page.goto("/redeem");
      await expect(page.getByText("You will redeem")).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page.getByRole("combobox", { name: "Select bank" }).click();
      await page.getByText("BCA", { exact: true }).click();
      await page.getByPlaceholder("1234567890").fill("1234563210");
      await page.getByPlaceholder("As printed on the passbook").fill("SINGGIH BRILIAN TARA");
      await page.getByRole("button", { name: "Redeem", exact: true }).click();
      const summary = page.getByRole("dialog").filter({ hasText: "Transaction Summary" });
      await summary.getByRole("button", { name: "Continue to Confirmation" }).click();
      const pin = page.getByRole("dialog").filter({ hasText: "Confirm with PIN" });
      await expect(pin).toBeVisible();

      await logInAgainFromForgot(page, pin);
      await expect(page.getByTestId("pin-setup-dialog").getByRole("heading", { name: "Create a new PIN" })).toBeVisible({
        timeout: 15000,
      });
    });
  });
});
