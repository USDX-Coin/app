import { test, expect, type Page } from "@playwright/test";
import {
  loginViaStorage,
  forceEnglish,
  seedRetryAfter,
  VIEWPORTS,
} from "../helpers/playwright-utils";

async function gotoProfile(page: Page) {
  await loginViaStorage(page);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({
    timeout: 15000,
  });
}

async function openModal(page: Page) {
  await page.getByRole("button", { name: "Change Password" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe("Change Password (English)", () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglish(page);
    await gotoProfile(page);
  });

  test.describe("positive", () => {
    test("opens a modal with three fields and show/hide toggles", async ({ page }) => {
      await openModal(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByLabel("Current password", { exact: true })).toBeVisible();
      await expect(dialog.getByLabel("New password", { exact: true })).toBeVisible();
      await expect(dialog.getByLabel("Confirm new password", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Show password" })).toHaveCount(3);

      // Toggling reveals the entered value (type flips password → text).
      const current = dialog.getByLabel("Current password", { exact: true });
      await current.fill("secret");
      await expect(current).toHaveAttribute("type", "password");
      await dialog.getByRole("button", { name: "Show password" }).first().click();
      await expect(current).toHaveAttribute("type", "text");
    });

    test("valid input shows a success toast and closes the modal", async ({ page }) => {
      await openModal(page);
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Current password", { exact: true }).fill("Demo1234");
      await dialog.getByLabel("New password", { exact: true }).fill("NewPass1");
      await dialog.getByLabel("Confirm new password", { exact: true }).fill("NewPass1");
      await dialog.getByRole("button", { name: "Update Password" }).click();

      await expect(page.getByText("Password updated successfully")).toBeVisible();
      await expect(page.getByRole("dialog")).toBeHidden();
    });
  });

  test.describe("negative", () => {
    test("wrong current password → inline error, modal open, other fields intact", async ({
      page,
    }) => {
      await openModal(page);
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Current password", { exact: true }).fill("WrongPass1");
      await dialog.getByLabel("New password", { exact: true }).fill("NewPass1");
      await dialog.getByLabel("Confirm new password", { exact: true }).fill("NewPass1");
      await dialog.getByRole("button", { name: "Update Password" }).click();

      await expect(dialog.getByText("Current password is incorrect")).toBeVisible();
      await expect(dialog).toBeVisible();
      // The other fields are not reset.
      await expect(dialog.getByLabel("New password", { exact: true })).toHaveValue("NewPass1");
      await expect(dialog.getByLabel("Confirm new password", { exact: true })).toHaveValue(
        "NewPass1",
      );
    });

    test("weak new password → client validation error, no success", async ({ page }) => {
      await openModal(page);
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Current password", { exact: true }).fill("Demo1234");
      await dialog.getByLabel("New password", { exact: true }).fill("weak");
      await dialog.getByLabel("Confirm new password", { exact: true }).fill("weak");
      await dialog.getByRole("button", { name: "Update Password" }).click();

      await expect(dialog.getByText(/at least 8 characters/i)).toBeVisible();
      await expect(page.getByText("Password updated successfully")).toBeHidden();
    });

    test("mismatched confirmation → inline error", async ({ page }) => {
      await openModal(page);
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Current password", { exact: true }).fill("Demo1234");
      await dialog.getByLabel("New password", { exact: true }).fill("NewPass1");
      await dialog.getByLabel("Confirm new password", { exact: true }).fill("NewPass2");
      await dialog.getByRole("button", { name: "Update Password" }).click();

      await expect(dialog.getByText(/do not match/i)).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("429 renders a human-readable cooldown button", async ({ page }) => {
      await seedRetryAfter(page, 300);
      await page.reload();
      await openModal(page);
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Current password", { exact: true }).fill("Demo1234");
      await dialog.getByLabel("New password", { exact: true }).fill("NewPass1");
      await dialog.getByLabel("Confirm new password", { exact: true }).fill("NewPass1");
      await dialog.getByRole("button", { name: "Update Password" }).click();

      await expect(
        dialog.getByRole("button", { name: /Try again in 5 minutes/ }),
      ).toBeVisible();
    });

    test("Escape closes the modal (keyboard accessible)", async ({ page }) => {
      await openModal(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    });

    test("works on a 375px mobile viewport", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await openModal(page);
      await expect(
        page.getByRole("dialog").getByLabel("Current password", { exact: true }),
      ).toBeVisible();
    });
  });
});

test.describe("Change Password (Indonesian)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("usdx-lang", "id"));
    await gotoProfile(page);
  });

  test("renders Indonesian strings for the trigger and modal", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Keamanan" })).toBeVisible();
    await page.getByRole("button", { name: "Ganti Password" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Password lama", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Password baru", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Konfirmasi password baru", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Ubah Password" })).toBeVisible();
  });
});
