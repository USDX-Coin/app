import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedAccountPin,
  seedCustodialWallet,
  MOCK_CUSTODIAL_WALLET_SUMMARY,
} from "../helpers/playwright-utils";

// Create the PIN from inside the money paths (USDX-651). A custodial-wallet
// owner without a PIN reaches the Ringkasan of a transfer / a custodial redeem,
// sees the "no PIN yet" notice, creates the PIN right there, and approves the
// same transaction with it — without leaving the flow or logging in again.
// The account PIN is the "usdx-mock-pin" seam; `pinSet: false` on the profile
// copy is what the screens read first.
const NEW_PIN = "654321";
const TO = "0xabcdef1234567890abcdef1234567890abcdef12";

async function createPinFromNotice(page: Page, notice: ReturnType<Page["getByTestId"]>) {
  await expect(notice).toContainText("no PIN yet");
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
  await loginViaStorage(page, { pinSet: false, custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
}

test.describe("PIN Flow (create from the money paths)", () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglish(page);
    await seedCustodialWallet(page, { status: "ACTIVE", balance: "1000.00" });
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
      await loginViaStorage(page, { pinSet: true, custodialWallet: MOCK_CUSTODIAL_WALLET_SUMMARY });
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
      await pin.getByRole("button", { name: "Send", exact: true }).click();

      const notice = page.getByTestId("pin-confirm-not-set");
      await expect(notice).toBeVisible({ timeout: 15000 });
      await expect(pin.getByLabel("6-digit PIN")).toHaveCount(0);
      await createPinFromNotice(page, notice);

      // Back in the same PIN dialog, now with an input — and no stale "no PIN" sentence.
      await expect(pin.getByLabel("6-digit PIN")).toBeVisible();
      await expect(pin.getByText(/no PIN yet/)).toHaveCount(0);
      await pin.getByLabel("6-digit PIN").fill(NEW_PIN);
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
