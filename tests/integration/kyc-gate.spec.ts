import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedKycStatus,
  VIEWPORTS,
} from "../helpers/playwright-utils";

// USDX-153: KYC status tracker on /mint (dashboard home) + transaction action
// gate. Pages stay fully explorable; the primary action (mint/redeem) opens a
// per-status dialog until kyc_status = VERIFIED. Status is seeded through the
// mock seam (usdx-mock-kyc-status) + the persisted auth user. Bridge/Send are
// ComingSoon-gated, so they have no primary action to gate.

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
type Status = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
const MOCK_REJECT_REASON = "Foto KTP buram, mohon submit ulang.";

async function gotoWithStatus(page: Page, status: Status, path = "/mint") {
  await forceEnglish(page);
  await seedKycStatus(page, status);
  await loginViaStorage(page, { kycStatus: status });
  await page.goto(path);
}

const banner = (page: Page) => page.getByTestId("kyc-status-section");
const dialog = (page: Page) => page.getByRole("dialog");

test.describe("KYC Status Tracker (/mint)", () => {
  test.describe("positive", () => {
    test("VERIFIED shows success banner and mint flow proceeds without gate", async ({
      page,
    }) => {
      await gotoWithStatus(page, "VERIFIED");
      await expect(banner(page)).toContainText("Your identity is verified", {
        timeout: 15000,
      });

      await page.getByPlaceholder("0", { exact: true }).fill("100");
      await page
        .getByPlaceholder("0x5DC489Ad05Efc")
        .fill(VALID_ADDRESS);
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      // VERIFIED proceeds without the KYC gate — the Ringkasan review modal opens.
      await expect(page.getByText("Transaction Summary")).toBeVisible();
      await expect(page.getByText("Complete KYC")).toHaveCount(0);
    });
  });

  test.describe("negative", () => {
    test("UNVERIFIED shows warning banner with Complete KYC link to /kyc", async ({
      page,
    }) => {
      await gotoWithStatus(page, "UNVERIFIED");
      await expect(banner(page)).toContainText("Verify your identity", {
        timeout: 15000,
      });
      await expect(
        banner(page).getByRole("link", { name: "Complete KYC" })
      ).toHaveAttribute("href", "/kyc");
    });

    test("PENDING shows in-review banner", async ({ page }) => {
      await gotoWithStatus(page, "PENDING");
      await expect(banner(page)).toContainText("Verification in review", {
        timeout: 15000,
      });
    });

    test("REJECTED shows error banner with reason and Submit Again link", async ({
      page,
    }) => {
      await gotoWithStatus(page, "REJECTED");
      await expect(banner(page)).toContainText(MOCK_REJECT_REASON, {
        timeout: 15000,
      });
      await expect(
        banner(page).getByRole("link", { name: "Submit Again" })
      ).toHaveAttribute("href", "/kyc");
    });
  });
});

test.describe("Transaction Action Gate", () => {
  test.describe("negative", () => {
    test("UNVERIFIED mint action opens the gate dialog routing to /kyc", async ({
      page,
    }) => {
      await gotoWithStatus(page, "UNVERIFIED");
      const mintBtn = page.getByRole("button", { name: "Mint", exact: true });
      // Stays clickable so the dialog can explain the lock (no dead button).
      await expect(mintBtn).toBeEnabled({ timeout: 15000 });
      await mintBtn.click();

      await expect(dialog(page)).toContainText("Complete KYC first");
      await dialog(page)
        .getByRole("button", { name: "Complete KYC" })
        .click();
      await expect(page).toHaveURL(/\/kyc$/);
    });

    test("PENDING action shows in-review dialog and Got it dismisses it", async ({
      page,
    }) => {
      await gotoWithStatus(page, "PENDING");
      await page.getByRole("button", { name: "Mint", exact: true }).click();

      await expect(dialog(page)).toContainText("Verification in review");
      await expect(dialog(page)).toContainText(
        "You can transact once your identity is verified"
      );
      await dialog(page).getByRole("button", { name: "Got it" }).click();
      await expect(dialog(page)).toHaveCount(0);
    });

    test("REJECTED action shows the rejection reason with Submit Again to /kyc", async ({
      page,
    }) => {
      await gotoWithStatus(page, "REJECTED");
      await page.getByRole("button", { name: "Mint", exact: true }).click();

      await expect(dialog(page)).toContainText(MOCK_REJECT_REASON);
      await dialog(page)
        .getByRole("button", { name: "Submit Again" })
        .click();
      await expect(page).toHaveURL(/\/kyc$/);
    });

    test("redeem action is gated too", async ({ page }) => {
      await gotoWithStatus(page, "UNVERIFIED", "/redeem");
      await page
        .getByRole("button", { name: "Redeem", exact: true })
        .click({ timeout: 15000 });
      await expect(dialog(page)).toContainText("Complete KYC first");
    });

    // Bridge and Send are gated behind ComingSoon until their backends exist —
    // the old forms faked success locally without any API call. Scoped to
    // <main>: the sidebar keeps both items as "Coming Soon" teasers, so the
    // phrase also appears in the page chrome (see sidebar-nav.spec.ts).
    test("bridge and send render ComingSoon instead of the fake forms", async ({
      page,
    }) => {
      const main = page.getByRole("main");

      await gotoWithStatus(page, "VERIFIED", "/bridge");
      // Dua pil, dan itu memang desainnya (Figma `20` Arah 3): satu di judul halaman,
      // satu di dalam kartu. Salah satunya pernah dihapus karena dikira duplikat.
      await expect(
        main.getByText("Coming soon", { exact: true })
      ).toHaveCount(2, { timeout: 15000 });
      await expect(
        main.getByRole("button", { name: "Bridge", exact: true })
      ).toHaveCount(0);

      await page.goto("/send");
      // Dua pil, dan itu memang desainnya (Figma `20` Arah 3): satu di judul halaman,
      // satu di dalam kartu. Salah satunya pernah dihapus karena dikira duplikat.
      await expect(
        main.getByText("Coming soon", { exact: true })
      ).toHaveCount(2, { timeout: 15000 });
      await expect(
        main.getByRole("button", { name: "Send", exact: true })
      ).toHaveCount(0);
    });
  });

  test.describe("edge cases", () => {
    test("banner and gate dialog work at mobile viewport (375px)", async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await gotoWithStatus(page, "UNVERIFIED");
      await expect(banner(page)).toContainText("Verify your identity", {
        timeout: 15000,
      });
      await page.getByRole("button", { name: "Mint", exact: true }).click();
      await expect(dialog(page)).toContainText("Complete KYC first");
    });
  });
});

// Identity and logout live in the Sidebar account menu (`ui/menu-profil.tsx`).
// The old `layout/Header.tsx` this block was named after is gone — it had no
// importers left once the sidebar took over the account row.
test.describe("Sidebar identity + logout", () => {
  test.describe("positive", () => {
    test("shows users.name when present", async ({ page }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/mint");
      await expect(
        page.getByText("Demo User").first()
      ).toBeVisible({ timeout: 15000 });
    });

    test("falls back to email when name is null (pre-KYC)", async ({ page }) => {
      await forceEnglish(page);
      await seedKycStatus(page, "UNVERIFIED");
      await loginViaStorage(page, { name: null, kycStatus: "UNVERIFIED" });
      await page.goto("/mint");
      await expect(
        page.getByText("demo@usdx.com").first()
      ).toBeVisible({ timeout: 15000 });
    });

    test("logout clears the session and redirects to /login", async ({
      page,
    }) => {
      await forceEnglish(page);
      await loginViaStorage(page);
      await page.goto("/mint");
      // Target the VISIBLE name, not a generic label: the account button has no
      // aria-label any more, precisely so a screen reader announces who is
      // signed in (WCAG 2.5.3) instead of "Account menu".
      await page
        .getByRole("button", { name: /Demo User/ })
        .click({ timeout: 15000 });
      await page.getByRole("menuitem", { name: "Log out" }).click();
      // Logging out asks first (PR 2, F.4) — the menu item opens a dialog, it
      // does not end the session on its own.
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Log out" })
        .click();
      await expect(page).toHaveURL(/\/login$/);

      // Session is gone: protected routes bounce back to /login.
      await page.goto("/mint");
      await expect(page).toHaveURL(/\/login$/);
    });
  });
});
