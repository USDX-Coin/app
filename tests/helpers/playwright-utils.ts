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

/**
 * Arm the mock's rate-limit seam (mock-api RETRY_AFTER_OVERRIDE_KEY): every
 * login/forgot-password/resend call throws 429 with this Retry-After value, so
 * specs can assert the human-readable cooldown formatting (USDX-167). Daily
 * limits (~22h) are unreachable in the per-page-load in-memory mock otherwise.
 * Call before the first page.goto(). Pass 0 to simulate a missing Retry-After.
 */
export async function seedRetryAfter(page: Page, seconds: number) {
  await page.addInitScript(
    (s) => localStorage.setItem("usdx-mock-retry-after", s),
    String(seconds),
  );
}

/**
 * Shorten the transient VERIFIED banner TTL (USDX-175 seam
 * usdx-mock-banner-ttl) so specs can assert auto-hide without waiting the full
 * 5s. Call before the first page.goto().
 */
export async function seedBannerTtl(page: Page, ms: number) {
  await page.addInitScript(
    (v) => localStorage.setItem("usdx-mock-banner-ttl", v),
    String(ms),
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

/**
 * Arm the redeem wallet seam (lib/redeem/wallet.ts MOCK_WALLET_SEAM_KEY).
 * Playwright has no wallet extension, so the contextual connect would otherwise
 * open RainbowKit and stall. With the seam armed, connect() resolves to a
 * deterministic mock address — letting the full redeem flow (connect →
 * Ringkasan → burn → tracker) run offline. Call before the first page.goto().
 *
 * Pass an `address` (0x…) to bind a specific wallet — used by the resume flow to
 * connect a wallet that differs from the order's bound `userAddress` and trigger
 * the "terikat ke wallet lain" warning (USDX-259). Default "1" → the mock default.
 */
export async function seedWallet(page: import("@playwright/test").Page, address?: string) {
  await page.addInitScript((v) => localStorage.setItem("usdx-mock-wallet", v), address ?? "1");
}

/**
 * Arm the redeem precondition seams (lib/redeem/wallet.ts, USDX-259) so the
 * network / balance / gas gate states are exercisable offline:
 *   chainId — wrong network → switch-network prompt (non-137)
 *   balanceUsdx — below the amount → insufficient-balance gate
 *   gasPol — 0 → low-gas warning (non-blocking)
 * Call before the first page.goto(). Only the provided keys are armed.
 */
export async function seedWalletState(
  page: import("@playwright/test").Page,
  state: { chainId?: number; balanceUsdx?: number; gasPol?: number },
) {
  await page.addInitScript((s) => {
    if (s.chainId !== undefined) localStorage.setItem("usdx-mock-wallet-chain", String(s.chainId));
    if (s.balanceUsdx !== undefined)
      localStorage.setItem("usdx-mock-wallet-balance", String(s.balanceUsdx));
    if (s.gasPol !== undefined) localStorage.setItem("usdx-mock-wallet-gas", String(s.gasPol));
  }, state);
}

/**
 * Arm the one-shot burn-rejection seam (mock-api BURN_REJECT_KEY, USDX-259): the
 * next broadcast throws a wallet-rejection error (then auto-disarms, so a retry
 * succeeds). Exercises the guard-double-burn error → retry path. Call before the
 * first page.goto().
 */
export async function seedBurnReject(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.setItem("usdx-mock-burn-reject", "1"));
}

/**
 * Arm the mint/redeem throughput-throttle seam (mock-api RATE_LIMIT_OVERRIDE_KEY,
 * USDX-252): every mint/redeem create + status poll returns 429 RATE_LIMITED with
 * this Retry-After, so the central throttle toast + poll backoff are testable
 * offline. Call before the first page.goto().
 */
export async function seedRateLimit(page: import("@playwright/test").Page, seconds = 3) {
  await page.addInitScript((s) => localStorage.setItem("usdx-mock-ratelimit", s), String(seconds));
}
