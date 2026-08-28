import { test, expect } from "@playwright/test";
import { clearAuth, forceEnglish } from "../helpers/playwright-utils";

// USDX-357 (WSTG-CLNT-12): the session token must never be written to browser storage.
// Extended: neither may the customer's personal data. After a real UI login the
// persisted `usdx-auth` blob holds exactly one key — `isAuthenticated` — so a
// device backup, a borrowed laptop or a browser extension finds no name, e-mail or
// phone number sitting at rest. Auth is carried by the httpOnly session cookie.
async function login(page: import("@playwright/test").Page) {
  await forceEnglish(page);
  await page.goto("/login");
  await clearAuth(page);
  await page.goto("/login");
  await page.getByPlaceholder("you@email.com").fill("demo@usdx.com");
  await page.getByPlaceholder("••••••••").fill("Demo1234");
  await page.getByRole("button", { name: "Login" }).click();
  // Lands on /mint once the session is established.
  await expect(page.getByText("You will mint")).toBeVisible({ timeout: 30000 });
}

test.describe("Token storage (USDX-357 · CLNT-12)", () => {
  test.describe("positive", () => {
    test("after login the persisted auth state keeps only isAuthenticated", async ({
      page,
    }) => {
      await login(page);

      const persisted = await page.evaluate(() => localStorage.getItem("usdx-auth"));
      expect(persisted).toBeTruthy();

      const parsed = JSON.parse(persisted as string) as {
        state: Record<string, unknown>;
      };
      // Credential is absent; the render hint remains so a reload doesn't flash the
      // login screen.
      expect(parsed.state.token ?? null).toBeNull();
      expect(parsed.state.isAuthenticated).toBe(true);
      expect(Object.keys(parsed.state)).toEqual(["isAuthenticated"]);
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

    // Asserts the bytes actually on the device after a real login, not the shape of
    // `partialize`. `users.phone` is stored encrypted server-side — persisting it in
    // clear on the device would undo that.
    test("no browser storage value contains the customer's name, email or phone", async ({
      page,
    }) => {
      await login(page);

      const leaked = await page.evaluate(() => {
        const pii = ["Demo User", "demo@usdx.com", "+628123456789"];
        const scan = (store: Storage) => {
          for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (!key) continue;
            const val = store.getItem(key) ?? "";
            const hit = pii.find((p) => val.includes(p));
            if (hit) return `${key} contains ${hit}`;
          }
          return null;
        };
        return scan(localStorage) ?? scan(sessionStorage);
      });
      expect(leaked).toBeNull();
    });
  });
});
