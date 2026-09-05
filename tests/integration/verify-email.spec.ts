import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// /verify-email (USDX-151): auto-calls POST verify-email with ?token=... on mount.
// Success issues a session (auto-login) and redirects to the dashboard (/mint).
//
// The failure half used to be one screen for two different situations. Figma 34
// splits them, because the way out differs: a token the SERVER rejected can be
// replaced (ask for the address, send a new link), while a link that arrived
// with no token at all cannot — the only useful exits there are sign in and
// register. Both specs below assert the exit, not just the wording.

test.describe("Verify Email Page", () => {
  test.describe("positive", () => {
    test("valid token auto-verifies and redirects to mint", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/verify-email");
      await clearAuth(page);
      await page.goto("/verify-email?token=valid-token");
      await page.waitForURL(/\/mint/, { timeout: 30000 });
    });
  });

  test.describe("negative", () => {
    test("server-rejected token offers a resend on the same screen", async ({ page }) => {
      await forceEnglish(page);
      await page.goto("/verify-email");
      await clearAuth(page);
      await page.goto("/verify-email?token=expired-token");
      await expect(
        page.getByRole("heading", { name: "This link has expired" })
      ).toBeVisible({ timeout: 10000 });
      // Our sentence, never the API's raw message (finding B3).
      await expect(page.getByText("An activation link is valid for 24 hours")).toBeVisible();
      await expect(
        page.getByText("This link is invalid or has expired", { exact: true })
      ).toHaveCount(0);

      // The token carries no address, so the screen asks for one and sends a new
      // link — landing on the check-email page that owns the cooldown.
      await page.getByPlaceholder("name@email.com").fill("someone@example.com");
      await page.getByRole("button", { name: "Send a new link" }).click();
      await page.waitForURL(/\/register\/check-email/, { timeout: 15000 });
      await expect(
        page.getByRole("heading", { name: "Check your email" })
      ).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("missing token renders the invalid-link screen without calling the API", async ({
      page,
    }) => {
      await forceEnglish(page);
      await page.goto("/verify-email");
      await clearAuth(page);

      let verifyCalls = 0;
      page.on("request", (req) => {
        if (req.url().includes("/auth/verify-email")) verifyCalls += 1;
      });

      await page.goto("/verify-email");
      await expect(
        page.getByRole("heading", { name: "This link is not valid" })
      ).toBeVisible({ timeout: 10000 });
      expect(verifyCalls).toBe(0);

      // Two exits, because an activation link is single-use: the commonest
      // reason to land here is an account that is already active.
      await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
        "href",
        "/login"
      );
      await expect(page.getByRole("link", { name: "Register" })).toHaveAttribute(
        "href",
        "/register"
      );
      // No resend form here — there is nothing to resend without a token.
      await expect(page.getByRole("button", { name: "Send a new link" })).toHaveCount(0);
    });
  });
});
