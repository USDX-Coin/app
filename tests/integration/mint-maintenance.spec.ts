import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  forceIndonesian,
  seedMintAvailable,
  seedMintMaintenance,
} from "../helpers/playwright-utils";

// Mint gate (USDX-640). While the test bundle runs, minting is open only to a
// list of testers (USDX-636). Everyone else has to be told BEFORE they type a
// figure — and told it is maintenance. "Test mode" is our internal word; a user
// who is not part of the test should never read it on a page about their money.

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
const MAINTENANCE = "Minting is under maintenance";

async function fillMintForm(page: Page) {
  await page.getByPlaceholder("0", { exact: true }).fill("100");
  await page.getByPlaceholder("0x5DC489Ad05Efc").fill(VALID_ADDRESS);
}

test.describe("Mint gate — maintenance", () => {
  test.describe("positive", () => {
    test("no gate field at all → the mint form behaves exactly as before", async ({ page }) => {
      // The field only exists from USDX-636 onwards. Shipping the app first must
      // not take minting away from everyone.
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });

      await expect(page.getByText(MAINTENANCE)).toHaveCount(0);
      await fillMintForm(page);
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeEnabled();
    });

    test("mintAvailable true → normal flow, no notice", async ({ page }) => {
      await forceEnglish(page);
      await seedMintAvailable(page, true);
      await loginViaStorage(page);
      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });

      await expect(page.getByText(MAINTENANCE)).toHaveCount(0);
      await fillMintForm(page);
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeEnabled();
    });
  });

  test.describe("negative", () => {
    test("mintAvailable false → maintenance notice and an unusable form", async ({ page }) => {
      await forceEnglish(page);
      await seedMintAvailable(page, false);
      await loginViaStorage(page);
      await page.goto("/mint");
      await expect(page.getByText(MAINTENANCE)).toBeVisible({ timeout: 15000 });

      // Nothing about this page invites the user to keep going.
      await expect(page.getByPlaceholder("0", { exact: true })).toBeDisabled();
      await expect(page.getByPlaceholder("0x5DC489Ad05Efc")).toBeDisabled();
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });

    test("the gate closing mid-session shows the same notice, not a raw error", async ({
      page,
    }) => {
      // Config said yes, the create says no. The user must land in the same
      // place, with the same words.
      await forceEnglish(page);
      await seedMintMaintenance(page);
      await loginViaStorage(page);
      await page.goto("/mint");
      await expect(page.getByText("You will mint")).toBeVisible({ timeout: 15000 });

      await fillMintForm(page);
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await page.getByRole("button", { name: "Proceed Payment" }).click();

      const dialog = page.getByRole("dialog", { name: "Transaction Summary" });
      await expect(
        dialog.getByText("Minting is temporarily unavailable while we carry out maintenance"),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/mint$/);

      // …and the page closes behind it — no immediate retry into the same 503.
      // The create refused, so the config the page re-reads refuses too.
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.locator("main").getByText(MAINTENANCE)).toBeVisible();
      await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    });
  });

  test.describe("edge cases", () => {
    test("the notice never says 'test mode', in either language", async ({ page }) => {
      // The reason minting is closed is a tester-only bundle. That is our
      // business; the user is told about maintenance and nothing else.
      await forceIndonesian(page);
      await seedMintAvailable(page, false);
      await loginViaStorage(page);
      await page.goto("/mint");
      await expect(page.getByText("Mint sedang dalam pemeliharaan")).toBeVisible({
        timeout: 15000,
      });

      const body = (await page.locator("main").innerText()).toLowerCase();
      expect(body).not.toContain("mode uji");
      expect(body).not.toContain("test mode");
      expect(body).not.toContain("mint_mode");
    });
  });
});
