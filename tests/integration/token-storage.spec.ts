import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// USDX-357 (WSTG-CLNT-12): the session token must never be written to browser storage.
// After a real UI login the persisted `usdx-auth` blob may keep non-credential UX state
// (user, isAuthenticated) but MUST NOT contain the token — otherwise an XSS payload could
// lift it straight out of localStorage. Auth is carried by the httpOnly session cookie.
async function login(page: import("@playwright/test").Page) {
  await forceEnglish(page);
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await page.getByPlaceholder("name@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("Enter your password").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  // Lands on /mint once the session is established.
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 30000 });
}

test.describe("Token storage (USDX-357 · CLNT-12)", () => {
  test.describe("positive", () => {
    test("after login the persisted auth state keeps user/isAuthenticated but not the token", async ({
      page,
    }) => {
      await login(page);

      const persisted = await page.evaluate(() => localStorage.getItem("usdx-auth"));
      expect(persisted).toBeTruthy();

      const parsed = JSON.parse(persisted as string) as {
        state: { token?: unknown; user?: unknown; isAuthenticated?: unknown };
      };
      // Credential is absent; UX state remains so a reload doesn't flash the login screen.
      expect(parsed.state.token ?? null).toBeNull();
      expect(parsed.state.user).toBeTruthy();
      expect(parsed.state.isAuthenticated).toBe(true);
    });
  });

  test.describe("negative", () => {
    test("no localStorage/sessionStorage value anywhere contains the token string", async ({
      page,
    }) => {
      await login(page);

      const leaked = await page.evaluate(() => {
        const scan = (store: Storage) => {
          for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (key && /token/i.test(store.getItem(key) ?? "")) {
              // Allow the persisted key itself only if it carries no `token` field.
              const val = store.getItem(key) ?? "";
              if (/"token"\s*:\s*"[^"]+"/.test(val)) return `${key}=${val}`;
            }
          }
          return null;
        };
        return scan(localStorage) ?? scan(sessionStorage);
      });
      expect(leaked).toBeNull();
    });
  });
});
