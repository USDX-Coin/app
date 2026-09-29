import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRelogin } from "@/hooks/useRelogin";
import { useAuthStore } from "@/stores/authStore";
import { logout as revokeSession } from "@/lib/api/auth-api";
import { reloginLanding } from "@/lib/auth/relogin-intent";
import type { User } from "@/types";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/lib/api/auth-api", () => ({ logout: vi.fn() }));
const revokeMock = vi.mocked(revokeSession);

// "Login ulang" (custodial-wallet.md §5.1, USDX-697 — alur yang sama dipakai
// USDX-696): tandai niat, akhiri sesi ini, ke halaman login. Login berikutnya
// memberi sesi password-auth segar (< 5 menit) yang diminta pin.yaml § set.
const USER = { id: "usr_1", email: "demo@usdx.com", pinSet: false } as User;

beforeEach(() => {
  push.mockReset();
  revokeMock.mockReset();
  sessionStorage.clear();
  useAuthStore.getState().setAuth(USER, "token");
});

describe("useRelogin", () => {
  describe("positive", () => {
    test("marks the intent, revokes this session, clears the store and goes to /login", () => {
      revokeMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useRelogin());

      act(() => result.current("create-pin"));

      expect(reloginLanding()).toBe("/settings");
      expect(revokeMock).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(push).toHaveBeenCalledWith("/login");
    });
  });

  describe("negative", () => {
    test("a failing revoke never traps the user — still logged out locally and sent to /login", async () => {
      revokeMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const { result } = renderHook(() => useRelogin());

      await act(async () => result.current("create-pin"));

      expect(useAuthStore.getState().user).toBeNull();
      expect(push).toHaveBeenCalledWith("/login");
    });
  });

  describe("edge case", () => {
    test("the intent is written BEFORE the store clears, so the login screen can already read it", () => {
      revokeMock.mockResolvedValueOnce(undefined);
      let landingWhenLoggedOut: string | null = "unset";
      const unsubscribe = useAuthStore.subscribe((s) => {
        if (!s.isAuthenticated) landingWhenLoggedOut = reloginLanding();
      });
      const { result } = renderHook(() => useRelogin());

      act(() => result.current("create-pin"));
      unsubscribe();

      expect(landingWhenLoggedOut).toBe("/settings");
    });
  });
});
