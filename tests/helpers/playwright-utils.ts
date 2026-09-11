import { expect, type Page } from "@playwright/test";

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
      // users.yaml § User.custodialWallet (USDX-566): null = non-custodial, the
      // common case. Specs for a custodial user override it together with
      // `seedCustodialWallet`, so the persisted copy and the mock agree.
      custodialWallet: null as null | {
        address: string | null;
        status: "PROVISIONING" | "ACTIVE" | "SUSPENDED";
      },
      // users.yaml § User.pinSet (USDX-567): the custodial money paths need a PIN.
      pinSet: true,
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

/**
 * Force the Indonesian locale before any page script runs, so specs can assert
 * the translated strings. Call before the first page.goto().
 */
export async function forceIndonesian(page: Page) {
  await page.addInitScript(() => localStorage.setItem("usdx-lang", "id"));
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
 * Arm the mock's CDD-on-record seam (mock-api KYC_CDD_OVERRIDE_KEY, USDX-545) so a
 * VERIFIED customer can be placed on either side of the CDD top-up: `false` (the
 * mock default, matching dev where no VERIFIED customer has CDD) shows the top-up
 * form, `true` hides it. Boolean flag only — never CDD values. Call before the
 * first page.goto().
 */
export async function seedKycCddComplete(page: Page, complete: boolean) {
  await page.addInitScript((c) => {
    if (c) localStorage.setItem("usdx-mock-kyc-cdd", "1");
    else localStorage.removeItem("usdx-mock-kyc-cdd");
  }, complete);
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

/**
 * Pilih pekerjaan lewat combobox pencarian (USDX-586). 99 nilai Permendagri tidak
 * lagi muat di `<select>`, jadi `selectOption("#occupation", …)` sudah tidak
 * berlaku: tombolnya membuka panel Popover + Command, dan penyaringan bekerja pada
 * LABEL yang terlihat — nilai enum tidak pernah ikut disaring maupun tampil.
 *
 * `label` memakai ejaan Permendagri apa adanya, sama di kedua bahasa.
 */
export async function pickOccupation(page: Page, label: string) {
  await page.getByTestId("occupation-trigger").click();
  await page.getByPlaceholder(/Search occupation|Cari pekerjaan/).fill(label);
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.getByTestId("occupation-trigger")).toContainText(label);
}

/**
 * Pilih satu nilai di dropdown KYC (`KycSelect`). Sejak commit 8177459 tujuh kontrol
 * itu Radix `Select`, bukan `<select>` native, jadi `selectOption("#gender", …)` sudah
 * tidak mungkin jalan: triggernya `<button role="combobox">` dan pilihannya baru ada
 * di DOM setelah panelnya terbuka (USDX-671). Polanya sama dengan `redeem.spec.ts`
 * dan `balance-test-mode.spec.ts`.
 *
 * Dialamati lewat `#id`, bukan nama aksesibelnya: spec KYC berjalan di DUA bahasa
 * sementara id-nya sama di keduanya. `option` memakai teks yang TERLIHAT — nilai enum
 * tidak pernah sampai ke DOM Radix — jadi untuk spec dwibahasa kirim RegExp yang
 * memuat kedua label, seperti kotak pencarian di `pickOccupation`.
 */
export async function pickKycSelect(page: Page, id: string, option: string | RegExp) {
  const trigger = page.locator(`#${id}`);
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  // Bukan sekadar "kliknya mendarat": triggernya harus benar-benar membawa jawaban
  // itu sekarang, karena di situlah satu-satunya tempat nilai terpilih terbaca.
  await expect(trigger).toHaveText(option);
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
  state: {
    chainId?: number;
    balanceUsdx?: number;
    /** Balance of the test-mint token — the strip in TEST mode (USDX-640). */
    testBalanceUsdx?: number;
    gasPol?: number;
  },
) {
  await page.addInitScript((s) => {
    if (s.chainId !== undefined) localStorage.setItem("usdx-mock-wallet-chain", String(s.chainId));
    if (s.balanceUsdx !== undefined)
      localStorage.setItem("usdx-mock-wallet-balance", String(s.balanceUsdx));
    if (s.testBalanceUsdx !== undefined)
      localStorage.setItem("usdx-mock-wallet-balance-test", String(s.testBalanceUsdx));
    if (s.gasPol !== undefined) localStorage.setItem("usdx-mock-wallet-gas", String(s.gasPol));
  }, state);
}

/**
 * Arm the mock's mint-availability seam (mock-api MINT_AVAILABLE_OVERRIDE_KEY,
 * USDX-640): `false` plays a user who is not on the list allowed to mint while
 * the test bundle runs, so `GET /api/v2/config` returns `mintAvailable: false`
 * and the mint page shows the maintenance notice. Call before the first
 * page.goto(). Leaving it unarmed omits the field entirely, which is what the
 * backend does before USDX-636 ships.
 */
export async function seedMintAvailable(
  page: import("@playwright/test").Page,
  available: boolean,
) {
  await page.addInitScript((a) => {
    if (a) localStorage.removeItem("usdx-mock-mint-available");
    else localStorage.setItem("usdx-mock-mint-available", "false");
  }, available);
}

/**
 * Arm the one-shot mint-maintenance seam (mock-api MINT_MAINTENANCE_KEY,
 * USDX-640): the next `POST /api/v2/mint` replies 503 MINT_UNDER_MAINTENANCE —
 * the gate closing after the config was already read as open. Disarms itself, so
 * a retry goes through. Call before the first page.goto().
 */
export async function seedMintMaintenance(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.setItem("usdx-mock-mint-maintenance", "1"));
}

/**
 * Arm the mock's mint-mode seam (mock-api MINT_MODE_OVERRIDE_KEY, USDX-640) so
 * `GET /api/v2/config` reports the test bundle the way the back-office switch
 * will (USDX-636). In TEST the mock also returns `testContractAddress` alongside
 * the unchanged production `contractAddress` — the strip reads that second field.
 * Call before the first page.goto().
 */
export async function seedMintMode(
  page: import("@playwright/test").Page,
  mode: "PROD" | "TEST",
) {
  await page.addInitScript((m) => {
    if (m === "TEST") localStorage.setItem("usdx-mock-mint-mode", "TEST");
    else localStorage.removeItem("usdx-mock-mint-mode");
  }, mode);
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
 * Arm the payout-rejection seam (mock-api PAYOUT_FAILED_KEY, USDX-664): the mock
 * payout is refused definitively, so the order lands on `PAYOUT_FAILED` a few
 * seconds after the burn instead of completing. The state ops resolve by hand — the
 * only way to reach it offline. Call before the first page.goto().
 */
export async function seedPayoutFailed(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.setItem("usdx-mock-payout-failed", "1"));
}

/**
 * Arm the account-inquiry seam (mock-api INQUIRY_NAME_KEY, USDX-661): the created
 * order comes back with THIS holder name, whatever the customer typed — the real
 * backend overrides the name with the inquiry result. Lets a spec prove the pre-burn
 * screen states the BANK's answer and not the form input. Call before the first
 * page.goto().
 */
export async function seedInquiryName(page: import("@playwright/test").Page, name: string) {
  await page.addInitScript((n) => localStorage.setItem("usdx-mock-inquiry-name", n), name);
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

/** Address the mock hands every custodial wallet (mock-api MOCK_CUSTODIAL_ADDRESS). */
export const MOCK_CUSTODIAL_ADDRESS = "0x000000C528aE908fB929a0898B65e913623c9aFf";
/** Profile summary of an ACTIVE mock wallet — pass to `loginViaStorage` next to `seedCustodialWallet` (USDX-567). */
export const MOCK_CUSTODIAL_WALLET_SUMMARY = { address: MOCK_CUSTODIAL_ADDRESS, status: "ACTIVE" as const };
/** The mock account PIN (mock-custodial-wallet MOCK_PIN). */
export const MOCK_PIN = "123456";

/**
 * Arm the mock's custodial-wallet seam (mock-api CUSTODIAL_SEAM_KEY, USDX-566).
 * The mock keeps one wallet per browser in localStorage ("usdx-mock-custodial")
 * so the wallet survives `page.goto`. Pass:
 *   - `null` → the user has no wallet (POST creates one; GET → 404 WALLET_NOT_FOUND)
 *   - a status, plus optional `balance` ("125.50", or `null` = RPC unreadable →
 *     the UI must print "—"), `stuck` (PROVISIONING never flips to ACTIVE until
 *     a repeat POST — the "coba lagi" path of custodial-wallet.md §5.5).
 * Applied ONCE per tab (sessionStorage marker), unlike the constant seams:
 * this state is mutated by the flow under test, and an init script re-runs on
 * every navigation — re-seeding on a later `page.goto` would wipe the wallet
 * the test just created. Call before the first page.goto().
 */
export async function seedCustodialWallet(
  page: Page,
  state:
    | null
    | {
        status: "PROVISIONING" | "ACTIVE" | "SUSPENDED";
        balance?: string | null;
        stuck?: boolean;
        // USDX-567 seams (mock-custodial-wallet): key zone down → 503; transfer
        // limits → 422 TRANSFER_LIMIT_EXCEEDED; first transfer per key hangs →
        // 409 IDEMPOTENCY_KEY_IN_PROGRESS then settles. The account PIN is a
        // separate seam (`seedAccountPin`): it belongs to the account, not the wallet.
        serviceDown?: boolean;
        transferLimit?: { perTx?: string; daily?: string };
        slowFirstTransfer?: boolean;
      },
) {
  await page.addInitScript(
    (s) => {
      if (sessionStorage.getItem("usdx-mock-custodial-seeded")) return;
      sessionStorage.setItem("usdx-mock-custodial-seeded", "1");
      if (s === null) {
        localStorage.removeItem("usdx-mock-custodial");
        return;
      }
      localStorage.setItem(
        "usdx-mock-custodial",
        JSON.stringify({
          status: s.status,
          address: s.status === "PROVISIONING" ? null : s.address,
          createdAt: "2026-09-11T00:00:00.000Z",
          activateAt: null,
          balance: s.status === "PROVISIONING" ? null : (s.balance === undefined ? "0.00" : s.balance),
          stuck: s.stuck ?? false,
          serviceDown: s.serviceDown ?? false,
          transferLimit: s.transferLimit,
          slowFirstTransfer: s.slowFirstTransfer ?? false,
        }),
      );
    },
    state === null ? null : { ...state, address: MOCK_CUSTODIAL_ADDRESS },
  );
}

/**
 * Arm the mock's account-PIN seam (mock-pin "usdx-mock-pin", USDX-651). The
 * account PIN is separate from the wallet: `null` plays a user who has no PIN
 * yet (custodial transfer/redeem → 401 PIN_NOT_SET, Settings offers "Create
 * PIN"); a 6-digit string plays an existing PIN other than the default
 * `MOCK_PIN`. Unarmed = the demo account with PIN `MOCK_PIN`. Applied ONCE per
 * tab like `seedCustodialWallet`: the flow under test creates/changes the PIN,
 * and an init script re-runs on every navigation. Call before the first page.goto().
 */
export async function seedAccountPin(page: Page, pin: string | null) {
  await page.addInitScript((p) => {
    if (sessionStorage.getItem("usdx-mock-pin-seeded")) return;
    sessionStorage.setItem("usdx-mock-pin-seeded", "1");
    localStorage.setItem("usdx-mock-pin", JSON.stringify({ pin: p }));
  }, pin);
}

/**
 * Shorten the custodial poll window (useCustodialWallet seam
 * "usdx-mock-custodial-poll-budget", read only in mock mode) so the "still
 * being set up" + retry state is reachable without waiting a full minute.
 * Call before the first page.goto().
 */
export async function seedCustodialPollBudget(page: Page, ms: number) {
  await page.addInitScript(
    (v) => localStorage.setItem("usdx-mock-custodial-poll-budget", v),
    String(ms),
  );
}

/**
 * Arm the one-shot create-failure seam (mock-api CUSTODIAL_FAIL_CREATE_KEY):
 * the next POST /api/v2/wallet answers 503 WALLET_SERVICE_UNAVAILABLE and
 * creates nothing, then the seam disarms so a retry goes through. Call before
 * the first page.goto().
 */
export async function seedCustodialCreateFailure(page: Page) {
  await page.addInitScript(() => localStorage.setItem("usdx-mock-custodial-fail-create", "1"));
}
