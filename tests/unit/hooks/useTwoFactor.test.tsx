import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mapTwoFactorError, useTwoFactor } from "@/hooks/useTwoFactor";
import { useAuthStore } from "@/stores/authStore";
import { ApiError } from "@/lib/api/client";
import {
  MOCK_TOTP_CODE,
  isMockTwoFactorEnabled,
  resetMockTwoFactor,
  seedMockTwoFactor,
} from "@/lib/api/mock-two-factor";
import type { User } from "@/types";

// Settings → 2FA (two-factor.yaml, USDX-714): enable → verify, disable, regenerate.
// A success flips `user.twoFactorEnabled` in the store AND the /auth/me cache at
// once, so /send opened right after never reads a stale value (users.yaml §
// User.twoFactorEnabled; the `pinSet` lesson from the app#75 review).

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
  twoFactorEnabled: false,
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["session", "me"], USER);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useTwoFactor(), { wrapper });
  return { result, queryClient };
}

function cachedFlag(queryClient: QueryClient) {
  return queryClient.getQueryData<User>(["session", "me"])?.twoFactorEnabled;
}

beforeEach(() => {
  localStorage.clear();
  resetMockTwoFactor();
  useAuthStore.getState().setAuth(USER, "tok");
});

describe("useTwoFactor", () => {
  describe("positive", () => {
    test("enable returns the QR + backup codes; verify turns it on in store + cache", async () => {
      const { result, queryClient } = setup();
      expect(result.current.twoFactorEnabled).toBe(false);

      let enrollment: Awaited<ReturnType<typeof result.current.enable>> | undefined;
      await act(async () => {
        enrollment = await result.current.enable("Demo1234");
      });
      expect(enrollment?.totpUri).toMatch(/^otpauth:/);
      expect(result.current.twoFactorEnabled).toBe(false);

      await act(async () => {
        await result.current.verify(MOCK_TOTP_CODE);
      });
      expect(result.current.twoFactorEnabled).toBe(true);
      expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(true);
      expect(cachedFlag(queryClient)).toBe(true);
    });

    test("disable turns it off in store + cache", async () => {
      seedMockTwoFactor(true);
      useAuthStore.getState().patchUser({ twoFactorEnabled: true });
      const { result, queryClient } = setup();

      await act(async () => {
        await result.current.disable({ password: "Demo1234" });
      });
      expect(isMockTwoFactorEnabled()).toBe(false);
      expect(result.current.twoFactorEnabled).toBe(false);
      expect(cachedFlag(queryClient)).toBe(false);
    });

    test("regenerate returns the new set", async () => {
      seedMockTwoFactor(true);
      const { result } = setup();
      let codes: string[] = [];
      await act(async () => {
        codes = await result.current.regenerate("Demo1234");
      });
      expect(codes.length).toBeGreaterThan(0);
    });
  });

  describe("negative", () => {
    test("a wrong code at verify maps to the code field and leaves 2FA off", async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.enable("Demo1234");
      });
      await act(async () => {
        await result.current.verify("000000").catch(() => undefined);
      });
      await waitFor(() => expect(result.current.error).toEqual({ where: "code", key: "twoFactor.errCode" }));
      expect(result.current.twoFactorEnabled).toBe(false);
    });

    test("TWO_FACTOR_NOT_ENABLED corrects a stale 'on' copy to off", async () => {
      useAuthStore.getState().patchUser({ twoFactorEnabled: true });
      const { result, queryClient } = setup();
      await act(async () => {
        await result.current.regenerate("Demo1234").catch(() => undefined);
      });
      expect(result.current.twoFactorEnabled).toBe(false);
      expect(cachedFlag(queryClient)).toBe(false);
    });

    test("429 arms the countdown from Retry-After and shows no inline error", async () => {
      seedMockTwoFactor(true);
      const { result } = setup();
      for (let i = 0; i < 5; i += 1) {
        await act(async () => {
          await result.current.disable({ password: "nope" }).catch(() => undefined);
        });
      }
      await act(async () => {
        await result.current.disable({ password: "Demo1234" }).catch(() => undefined);
      });
      await waitFor(() => expect(result.current.cooldownSeconds).toBeGreaterThan(0));
      expect(result.current.error).toBeNull();
      expect(isMockTwoFactorEnabled()).toBe(true);
    });
  });

  describe("edge case", () => {
    test("an older session without the field reads as unknown (null), not off", () => {
      const { twoFactorEnabled: _dropped, ...legacy } = USER;
      useAuthStore.getState().setAuth(legacy, "tok");
      const { result } = setup();
      expect(result.current.twoFactorEnabled).toBeNull();
    });

    test("mapTwoFactorError routes each answer to its place", () => {
      expect(mapTwoFactorError(new ApiError(401, "INVALID_CREDENTIALS", "x"))).toEqual({
        where: "password",
        key: "twoFactor.errPassword",
      });
      expect(mapTwoFactorError(new ApiError(401, "INVALID_TWO_FACTOR_CODE", "x"))).toEqual({
        where: "code",
        key: "twoFactor.errCode",
      });
      expect(mapTwoFactorError(new ApiError(400, "TWO_FACTOR_NOT_ENABLED", "x"))).toEqual({
        where: "form",
        key: "twoFactor.errNotEnabled",
      });
      expect(mapTwoFactorError(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", undefined, 60))).toBeNull();
      expect(mapTwoFactorError(new ApiError(500, "INTERNAL", "x"))).toEqual({
        where: "form",
        key: "error.server",
      });
      expect(mapTwoFactorError(new TypeError("Failed to fetch"))).toEqual({
        where: "form",
        key: "error.offline",
      });
      expect(mapTwoFactorError(null)).toBeNull();
    });
  });
});
