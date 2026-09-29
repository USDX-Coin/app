import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import {
  useCustodialStepUp,
  stepUpErrorKey,
  isPinLockout,
} from "@/hooks/useCustodialStepUp";
import { useAuthStore } from "@/stores/authStore";
import { getCustodialWallet } from "@/lib/api/wallet-api";
import { ApiError } from "@/lib/api/client";
import type { CustodialWallet, User } from "@/types";

vi.mock("@/lib/api/wallet-api", () => ({
  getCustodialWallet: vi.fn(),
  createCustodialWallet: vi.fn(),
}));
const getWalletMock = vi.mocked(getCustodialWallet);

// Guard shared by transfer and custodial redeem (custodial-wallet.md §6.1, USDX-717):
// 2FA must be on (`user.twoFactorEnabled`), money out may be held for 24 hours
// (`GET /wallet outboundLockedUntil` or a 409 CUSTODIAL_OUTBOUND_LOCKED), and the
// `2fa-stepup` lockout has its own countdown, separate from the PIN one.
const OWN = "0x000000C528aE908fB929a0898B65e913623c9aFf";
const USER: User = {
  id: "usr_1",
  name: "Demo",
  email: "demo@usdx.com",
  phone: null,
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  pinSet: true,
  twoFactorEnabled: true,
  custodialWallet: { address: OWN, status: "ACTIVE" },
};
const WALLET: CustodialWallet = {
  address: OWN,
  status: "ACTIVE",
  chain: "polygon",
  contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
  balance: "100.00",
  balanceWei: "100000000",
  balanceAt: "2026-08-28T04:12:31.000Z",
  createdAt: "2026-08-28T04:10:00.000Z",
  outboundLockedUntil: null,
};
const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();

function render() {
  return renderHook(() => useCustodialStepUp(), { wrapper: createWrapper() });
}

beforeEach(() => {
  useAuthStore.setState({ user: USER, isAuthenticated: true, token: "t" });
  getWalletMock.mockReset();
  getWalletMock.mockResolvedValue(WALLET);
});

describe("useCustodialStepUp", () => {
  describe("positive", () => {
    test("2FA off on the profile → setup required", () => {
      useAuthStore.setState({ user: { ...USER, twoFactorEnabled: false } });
      expect(render().result.current.twoFactorSetupRequired).toBe(true);
    });

    test("GET /wallet outboundLockedUntil in the future → locked until then", async () => {
      const until = inAnHour();
      getWalletMock.mockResolvedValue({ ...WALLET, outboundLockedUntil: until });
      const { result } = render();
      await waitFor(() => expect(result.current.lockedUntil).toBe(until));
    });

    test("409 CUSTODIAL_OUTBOUND_LOCKED (lock while the form was open) → locked from details", async () => {
      const until = inAnHour();
      const { result } = render();
      await waitFor(() => expect(getWalletMock).toHaveBeenCalled());
      act(() => {
        result.current.onError(
          new ApiError(409, "CUSTODIAL_OUTBOUND_LOCKED", "x", { lockedUntil: until }),
        );
      });
      expect(result.current.lockedUntil).toBe(until);
    });

    test("401 TWO_FACTOR_SETUP_REQUIRED corrects the profile copy to 2FA off", () => {
      const { result } = render();
      act(() => result.current.onError(new ApiError(401, "TWO_FACTOR_SETUP_REQUIRED", "x")));
      expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(false);
      expect(result.current.twoFactorSetupRequired).toBe(true);
    });

    test("429 scope 2fa-stepup arms the code countdown from Retry-After", () => {
      const { result } = render();
      act(() =>
        result.current.onError(
          new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { scope: "2fa-stepup" }, 900),
        ),
      );
      expect(result.current.twoFactorCooldownSeconds).toBe(900);
    });
  });

  describe("negative", () => {
    test("2FA on, or unknown (session saved before the field existed) → no setup card, nothing blocked", () => {
      expect(render().result.current.twoFactorSetupRequired).toBe(false);
      useAuthStore.setState({ user: { ...USER, twoFactorEnabled: undefined } });
      const { result } = render();
      expect(result.current.twoFactorSetupRequired).toBe(false);
      expect(result.current.blocked).toBe(false);
    });

    test("a lock in the past, or no field (backend before USDX-718), is not a lock", async () => {
      getWalletMock.mockResolvedValue({ ...WALLET, outboundLockedUntil: "2020-01-01T00:00:00.000Z" });
      const { result } = render();
      await waitFor(() => expect(getWalletMock).toHaveBeenCalled());
      expect(result.current.lockedUntil).toBeNull();
    });

    test("PIN lockout (scope pin or absent) does not arm the code countdown", () => {
      const { result } = render();
      act(() => result.current.onError(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { scope: "pin" }, 900)));
      act(() => result.current.onError(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", undefined, 900)));
      expect(result.current.twoFactorCooldownSeconds).toBe(0);
    });
  });

  describe("edge case", () => {
    test("a 409 lock seen by one hook instance reaches the other (redeem form + Ringkasan) via the wallet cache", async () => {
      const until = inAnHour();
      const { result } = renderHook(
        () => ({ review: useCustodialStepUp(), form: useCustodialStepUp() }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(getWalletMock).toHaveBeenCalled());
      await waitFor(() => expect(result.current.form.lockedUntil).toBeNull());
      act(() => {
        result.current.review.onError(
          new ApiError(409, "CUSTODIAL_OUTBOUND_LOCKED", "x", { lockedUntil: until }),
        );
      });
      expect(result.current.form.lockedUntil).toBe(until);
      expect(result.current.form.blocked).toBe(true);
    });

    test("the lock lifts by itself when its time passes — no reload", async () => {
      const until = new Date(Date.now() + 400).toISOString();
      getWalletMock.mockResolvedValue({ ...WALLET, outboundLockedUntil: until });
      const { result } = render();
      await waitFor(() => expect(result.current.lockedUntil).toBe(until));
      await waitFor(() => expect(result.current.lockedUntil).toBeNull(), { timeout: 2_000 });
    });
  });
});

describe("stepUpErrorKey / isPinLockout", () => {
  describe("positive", () => {
    test("wrong / missing code → sentences under the code field", () => {
      expect(stepUpErrorKey(new ApiError(401, "INVALID_TWO_FACTOR_CODE", "x"))).toBe("stepUp.errInvalid");
      expect(stepUpErrorKey(new ApiError(401, "TWO_FACTOR_CODE_REQUIRED", "x"))).toBe("stepUp.errRequired");
    });

    test("a PIN lockout is scope pin — or no scope at all (backend before USDX-718)", () => {
      expect(isPinLockout(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { scope: "pin" }))).toBe(true);
      expect(isPinLockout(new ApiError(429, "TOO_MANY_ATTEMPTS", "x"))).toBe(true);
    });
  });

  describe("negative", () => {
    test("other errors are not code errors, and a 2fa-stepup lockout is not a PIN lockout", () => {
      expect(stepUpErrorKey(new ApiError(401, "INVALID_PIN", "x"))).toBeNull();
      expect(stepUpErrorKey(null)).toBeNull();
      expect(isPinLockout(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { scope: "2fa-stepup" }))).toBe(false);
      expect(isPinLockout(new ApiError(429, "RATE_LIMITED", "x"))).toBe(false);
    });
  });

  describe("edge case", () => {
    test("SETUP_REQUIRED is not a code-field error (the setup card shows it)", () => {
      expect(stepUpErrorKey(new ApiError(401, "TWO_FACTOR_SETUP_REQUIRED", "x"))).toBeNull();
    });
  });
});
