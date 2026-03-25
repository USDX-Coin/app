import type { Page } from "@playwright/test";

const AUTH_STATE = {
  state: {
    user: {
      id: "usr_1",
      fullName: "Demo User",
      email: "demo@usdx.com",
      isVerified: true,
      createdAt: "2026-01-01T00:00:00Z",
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

export async function clearAuth(page: Page) {
  await page.evaluate(() => localStorage.removeItem("usdx-auth"));
}

export const VIEWPORTS = {
  smallMobile: { width: 320, height: 568 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
} as const;
