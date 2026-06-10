import type { Page } from "@playwright/test";

const AUTH_STATE = {
  state: {
    user: {
      id: "usr_1",
      name: "Demo User",
      email: "demo@usdx.com",
      phone: "+628123456789",
      entityType: "INDIVIDUAL",
      kycStatus: "VERIFIED",
      suspended: false,
      emailVerifiedAt: "2026-01-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    token: "mock-token",
    isAuthenticated: true,
  },
  version: 0,
};

export async function loginViaStorage(page: Page) {
  await page.goto("/login");
  await page.evaluate((auth) => {
    localStorage.setItem("usdx-auth", JSON.stringify(auth));
  }, AUTH_STATE);
}

/**
 * Dashboard UI defaults to Indonesian ("id"). Persist the English choice
 * before any page script runs so specs can assert the English strings.
 * Call before the first page.goto().
 */
export async function forceEnglish(page: Page) {
  await page.addInitScript(() => localStorage.setItem("usdx-lang", "en"));
}

export async function clearAuth(page: Page) {
  await page.evaluate(() => localStorage.removeItem("usdx-auth"));
}

export const VIEWPORTS = {
  smallMobile: { width: 320, height: 568 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
} as const;
