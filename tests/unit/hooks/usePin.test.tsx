import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper, createCachingWrapper } from "../../helpers/test-utils";
import { usePin, mapPinError } from "@/hooks/usePin";
import { useSession } from "@/hooks/useSession";
import { useAuthStore } from "@/stores/authStore";
import { setPin, changePin, getMe } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/client";
import type { User } from "@/types";

vi.mock("@/lib/api/auth-api", () => ({
  setPin: vi.fn(),
  changePin: vi.fn(),
  getMe: vi.fn(),
}));
const setPinMock = vi.mocked(setPin);
const changePinMock = vi.mocked(changePin);
const getMeMock = vi.mocked(getMe);

// Create / change PIN (pin.yaml § set / change, USDX-651). What the hook owns:
// the profile copy of `pinSet` follows the outcome at once (the money screens
// read that copy), the shared `pin` lockout becomes a countdown, and every
// failure lands on a field, not in a toast.
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
  pinSet: false,
  custodialWallet: null,
};

beforeEach(() => {
  setPinMock.mockReset();
  changePinMock.mockReset();
  getMeMock.mockReset();
  useAuthStore.getState().setAuth(USER, "token");
});

describe("mapPinError", () => {
  describe("positive", () => {
    test("wrong current PIN lands on the current field; unchanged lands on the new field", () => {
      expect(mapPinError(new ApiError(401, "INVALID_PIN", "x"))).toEqual({ where: "current", key: "pin.errInvalid" });
      expect(mapPinError(new ApiError(422, "PIN_UNCHANGED", "x"))).toEqual({ where: "new", key: "pin.errUnchanged" });
      expect(mapPinError(new ApiError(422, "VALIDATION_ERROR", "x"))).toEqual({ where: "new", key: "pin.errFormat" });
    });

    test("stale profile copies are said in words above the form", () => {
      expect(mapPinError(new ApiError(401, "REAUTH_REQUIRED", "x"))).toEqual({ where: "form", key: "pin.errAlreadySet" });
      expect(mapPinError(new ApiError(401, "PIN_NOT_SET", "x"))).toEqual({ where: "form", key: "pin.errNotSet" });
    });
  });

  describe("negative", () => {
    test("server / network failures use the shared failure keys, never the raw message", () => {
      expect(mapPinError(new ApiError(500, "INTERNAL", "boom"))).toEqual({ where: "form", key: "error.server" });
      expect(mapPinError(new TypeError("Failed to fetch"))).toEqual({ where: "form", key: "error.offline" });
      expect(mapPinError(new ApiError(403, "KYC_NOT_VERIFIED", "x"))).toEqual({ where: "form", key: "pin.errFailed" });
    });
  });

  describe("edge case", () => {
    test("no error and the lockout both map to null (the countdown is the message)", () => {
      expect(mapPinError(null)).toBeNull();
      expect(mapPinError(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }, 900))).toBeNull();
    });
  });
});

describe("usePin", () => {
  describe("positive", () => {
    test("setPin → POST body {pin}; user.pinSet flips to true at once", async () => {
      setPinMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => usePin(), { wrapper: createWrapper() });
      expect(result.current.pinSet).toBe(false);

      await act(async () => {
        await result.current.setPin("654321");
      });

      expect(setPinMock).toHaveBeenCalledWith({ pin: "654321" });
      expect(useAuthStore.getState().user?.pinSet).toBe(true);
      await waitFor(() => expect(result.current.pinSet).toBe(true));
    });

    test("changePin → POST body {currentPin, newPin}; pinSet stays true", async () => {
      useAuthStore.getState().setPinSet(true);
      changePinMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => usePin(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.changePin({ currentPin: "123456", newPin: "654321" });
      });

      expect(changePinMock).toHaveBeenCalledWith({ currentPin: "123456", newPin: "654321" });
      expect(useAuthStore.getState().user?.pinSet).toBe(true);
    });
  });

  describe("negative", () => {
    test("REAUTH_REQUIRED on set → the account already has a PIN: error above the form, profile copy corrected to true", async () => {
      setPinMock.mockRejectedValueOnce(new ApiError(401, "REAUTH_REQUIRED", "x"));
      const { result } = renderHook(() => usePin(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.setPin("654321").catch(() => undefined);
      });

      await waitFor(() =>
        expect(result.current.setPinError).toEqual({ where: "form", key: "pin.errAlreadySet" }),
      );
      expect(useAuthStore.getState().user?.pinSet).toBe(true);
    });

    test("PIN_NOT_SET on change → profile copy corrected to false", async () => {
      useAuthStore.getState().setPinSet(true);
      changePinMock.mockRejectedValueOnce(new ApiError(401, "PIN_NOT_SET", "x"));
      const { result } = renderHook(() => usePin(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.changePin({ currentPin: "123456", newPin: "654321" }).catch(() => undefined);
      });

      await waitFor(() => expect(result.current.changePinError?.key).toBe("pin.errNotSet"));
      expect(useAuthStore.getState().user?.pinSet).toBe(false);
    });

    test("wrong current PIN → error on the current field; pinSet untouched", async () => {
      useAuthStore.getState().setPinSet(true);
      changePinMock.mockRejectedValueOnce(new ApiError(401, "INVALID_PIN", "x"));
      const { result } = renderHook(() => usePin(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.changePin({ currentPin: "000000", newPin: "654321" }).catch(() => undefined);
      });

      await waitFor(() =>
        expect(result.current.changePinError).toEqual({ where: "current", key: "pin.errInvalid" }),
      );
      expect(useAuthStore.getState().user?.pinSet).toBe(true);
    });
  });

  describe("edge case", () => {
    test("TOO_MANY_ATTEMPTS → cooldown runs from Retry-After and no inline error", async () => {
      useAuthStore.getState().setPinSet(true);
      changePinMock.mockRejectedValueOnce(
        new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }, 900),
      );
      const { result } = renderHook(() => usePin(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.changePin({ currentPin: "000000", newPin: "654321" }).catch(() => undefined);
      });

      await waitFor(() => expect(result.current.cooldownSeconds).toBe(900));
      expect(result.current.changePinError).toBeNull();
    });

    test("a successful set stops a running cooldown (set resets the lockout)", async () => {
      setPinMock
        .mockRejectedValueOnce(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", undefined, 900))
        .mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => usePin(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.setPin("654321").catch(() => undefined);
      });
      await waitFor(() => expect(result.current.cooldownSeconds).toBe(900));

      await act(async () => {
        await result.current.setPin("654321");
      });
      await waitFor(() => expect(result.current.cooldownSeconds).toBe(0));
    });

    // A screen with `useSession` (Settings / Profile / KYC) cached /auth/me before
    // the PIN changed; /send and /redeem do not mount it, so invalidating alone
    // never refetches. Reopening that screen must not write the old copy back —
    // least of all when its refetch fails (custodial-wallet.md §5.1 "PIN di web").
    async function cacheSessionThenLeave(wrapper: ReturnType<typeof createCachingWrapper>, pinSet: boolean) {
      getMeMock.mockResolvedValueOnce({ ...USER, pinSet });
      const screen = renderHook(() => useSession(), { wrapper });
      await waitFor(() => expect(screen.result.current.data).toBeTruthy());
      screen.unmount();
    }

    async function reopenSessionScreenWithFailingRefetch(wrapper: ReturnType<typeof createCachingWrapper>) {
      getMeMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const screen = renderHook(() => useSession(), { wrapper });
      await waitFor(() => expect(screen.result.current.isFetching).toBe(false));
    }

    test("a cached /auth/me saying false does not undo a successful set when its screen reopens", async () => {
      const wrapper = createCachingWrapper();
      await cacheSessionThenLeave(wrapper, false);

      setPinMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => usePin(), { wrapper });
      await act(async () => {
        await result.current.setPin("246810");
      });
      expect(useAuthStore.getState().user?.pinSet).toBe(true);

      await reopenSessionScreenWithFailingRefetch(wrapper);
      expect(useAuthStore.getState().user?.pinSet).toBe(true);
    });

    test("a cached /auth/me saying true does not undo a PIN_NOT_SET correction when its screen reopens", async () => {
      useAuthStore.getState().setPinSet(true);
      const wrapper = createCachingWrapper();
      await cacheSessionThenLeave(wrapper, true);

      changePinMock.mockRejectedValueOnce(new ApiError(401, "PIN_NOT_SET", "x"));
      const { result } = renderHook(() => usePin(), { wrapper });
      await act(async () => {
        await result.current.changePin({ currentPin: "123456", newPin: "654321" }).catch(() => undefined);
      });
      expect(useAuthStore.getState().user?.pinSet).toBe(false);

      await reopenSessionScreenWithFailingRefetch(wrapper);
      expect(useAuthStore.getState().user?.pinSet).toBe(false);
    });

    test("pinSet is null for a persisted session that predates the field", () => {
      const { pinSet: _dropped, ...legacy } = USER;
      void _dropped;
      useAuthStore.getState().setAuth(legacy as User, "token");
      const { result } = renderHook(() => usePin(), { wrapper: createWrapper() });
      expect(result.current.pinSet).toBeNull();
    });
  });
});
