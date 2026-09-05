import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish, seedRetryAfter } from "../helpers/playwright-utils";

async function gotoLogin(page: import("@playwright/test").Page) {
  await forceEnglish(page);
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible({ timeout: 15000 });
}

test.describe("Login Page", () => {
  test.describe("positive", () => {
    test("displays login form correctly", async ({ page }) => {
      await gotoLogin(page);
      await expect(
        page.getByRole("heading", { name: "Welcome back" })
      ).toBeVisible();
      await expect(page.getByPlaceholder("name@email.com")).toBeVisible();
      await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    });

    test("logs in with valid credentials and redirects to mint", async ({
      page,
    }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
      await page.getByPlaceholder("Enter your password").fill("Demo1234");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("You will mint")).toBeVisible({
        timeout: 30000,
      });
    });

    test("has link to register page", async ({ page }) => {
      await gotoLogin(page);
      const link = page.getByRole("link", { name: "Create an account" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/register");
    });

    test("has link to forgot password", async ({ page }) => {
      await gotoLogin(page);
      const link = page.getByRole("link", { name: "Forgot password?" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/forgot-password");
    });
  });

  test.describe("negative", () => {
    test("shows error toast for invalid credentials", async ({ page }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("name@email.com").fill("wrong@email.com");
      await page.getByPlaceholder("Enter your password").fill("WrongPass1");
      await page.getByRole("button", { name: "Login" }).click();
      // Login errors surface as a sonner toast (auto-dismisses) — assert promptly.
      await expect(page.getByText("Invalid email or password")).toBeVisible({
        timeout: 10000,
      });
    });

    test("shows validation error for empty email", async ({ page }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("Enter your password").fill("Demo1234");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("Email is required")).toBeVisible({
        timeout: 10000,
      });
    });

    test("shows validation error for empty password", async ({ page }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("Password is required")).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("negative — unverified account", () => {
    // The banner used to say "reset your password via Forgot password" — the
    // Phase 1 migration path. Figma 31 (state "belum diverifikasi") replaced it:
    // a self-signup user has no password to reset, so the banner now carries the
    // action it actually needs, "Resend the link", which re-sends the activation
    // mail and lands on /register/check-email. Same guarantee as before — the
    // banner names the situation and offers a way out — asserted on the new one.
    test("shows verification banner whose action resends the activation link", async ({ page }) => {
      // Register a fresh (unverified) account, then reach /login via client-side
      // nav so the in-memory mock account survives (mock state is per page load).
      await forceEnglish(page);
      await page.goto("/register");
      await clearAuth(page);
      await page.reload();
      const email = `unverified-${Date.now()}@example.com`;
      await page.getByPlaceholder("Enter your email").fill(email);
      await page.getByPlaceholder("08xx or +62xx").fill(`0812${String(Date.now()).slice(-8)}`);
      await page.getByPlaceholder("Create a password").fill("TestPass1");
      await page.getByPlaceholder("Type the password again").fill("TestPass1");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForURL(/\/register\/check-email/, { timeout: 10000 });

      await page.getByRole("link", { name: "Back to sign in" }).click();
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await page.getByPlaceholder("name@email.com").fill(email);
      await page.getByPlaceholder("Enter your password").fill("TestPass1");
      await page.getByRole("button", { name: "Login" }).click();

      // Sonner's live region is also role=alert — filter to the banner by text.
      const banner = page.getByRole("alert").filter({
        hasText: "Email not verified yet",
      });
      await expect(banner).toBeVisible({ timeout: 10000 });
      // The banner names the address the mail went to, so the user can tell a
      // typo from a missing mail.
      await expect(banner).toContainText(email);

      await banner.getByRole("button", { name: "Resend the link" }).click();
      await page.waitForURL(/\/register\/check-email/, { timeout: 10000 });
      await expect(
        page.getByRole("heading", { name: "Check your email" })
      ).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("shows error for email that fails server validation", async ({ page }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("name@email.com").fill("notregistered@test.com");
      await page.getByPlaceholder("Enter your password").fill("WrongPass1");
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page.getByText("Invalid email or password")).toBeVisible({
        timeout: 10000,
      });
    });

    test("rate limits after 5 failed attempts with a cooldown countdown", async ({
      page,
    }) => {
      await gotoLogin(page);
      await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
      // 5 wrong attempts trip the mock's per-email limit (week1.md § Login);
      // the 6th returns 429 and the button switches to a ticking countdown.
      for (let attempt = 0; attempt < 5; attempt++) {
        await page.getByPlaceholder("Enter your password").fill("WrongPass1");
        await page.getByRole("button", { name: "Login" }).click();
        await expect(page.getByRole("button", { name: "Login" })).toBeEnabled({
          timeout: 10000,
        });
      }
      await page.getByRole("button", { name: "Login" }).click();
      const cooldownButton = page.getByRole("button", { name: /Try again in \d+s/ });
      await expect(cooldownButton).toBeVisible({ timeout: 10000 });
      await expect(cooldownButton).toBeDisabled();
    });

    test("rate-limit wait renders human-readable hours, not raw seconds (USDX-167)", async ({
      page,
    }) => {
      await gotoLogin(page);
      await seedRetryAfter(page, 76451); // daily-limit-scale 429 TOO_MANY_ATTEMPTS
      await page.reload();
      await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
      await page.getByPlaceholder("Enter your password").fill("Demo1234");
      await page.getByRole("button", { name: "Login" }).click();
      const cooldownButton = page.getByRole("button", {
        name: "Try again in about 22 hours",
      });
      await expect(cooldownButton).toBeVisible({ timeout: 10000 });
      await expect(cooldownButton).toBeDisabled();
      await expect(page.getByText("76451")).not.toBeVisible();
    });

    // Was: "Google and Web3 buttons are disabled". Figma 30 C weighed keeping
    // them behind a "coming soon" badge against removing them and chose removal
    // (finding F9): two permanently dead controls on the one screen whose job is
    // to sign you in, and wallet sign-in contradicts the email-first KYC flow
    // (USDX-153) anyway. The assertion is inverted rather than deleted, so the
    // buttons cannot creep back in as dead controls without a test failing.
    test("no dead social sign-in controls below the form", async ({ page }) => {
      await gotoLogin(page);
      await expect(page.getByRole("button", { name: "Google" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Web3 Wallet" })).toHaveCount(0);
      await expect(page.getByText("Or continue with")).toHaveCount(0);
      // Every button left on the screen is live.
      const disabled = page.locator("button:disabled");
      await expect(disabled).toHaveCount(0);
    });
  });
});
