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

export async function loginViaStorage(
  page: Page,
  userOverrides?: Partial<Omit<(typeof AUTH_STATE)["state"]["user"], "name">> & {
    name?: string | null;
  },
) {
  const auth = userOverrides
    ? {
        ...AUTH_STATE,
        state: {
          ...AUTH_STATE.state,
          user: { ...AUTH_STATE.state.user, ...userOverrides },
        },
      }
    : AUTH_STATE;
  await page.goto("/login");
  await page.evaluate((a) => {
    localStorage.setItem("usdx-auth", JSON.stringify(a));
  }, auth);
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

/**
 * Arm the mock's KYC status seam (mock-api KYC_OVERRIDE_KEY). The in-memory
 * mock resets per page load, so PENDING/REJECTED states are otherwise
 * unreachable across navigations. Call before the first page.goto().
 */
export async function seedKycStatus(
  page: Page,
  status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED",
) {
  await page.addInitScript(
    (s) => localStorage.setItem("usdx-mock-kyc-status", s),
    status,
  );
}

/** Tiny valid PNG for upload tests (file-type/size validation is client-side). */
export const TEST_PNG = {
  name: "photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
} as const;

export const VIEWPORTS = {
  smallMobile: { width: 320, height: 568 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
} as const;
