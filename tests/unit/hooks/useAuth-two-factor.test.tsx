import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { resetMockTwoFactor, seedMockTwoFactor } from "@/lib/api/mock-two-factor";

// Login on an account with 2FA (auth.yaml § loginV2, USDX-714): step 1 is NOT a
// login — no session in the store, no navigation; the caller shows the code step.

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const DEMO = { email: "demo@usdx.com", password: "Demo1234" };

beforeEach(() => {
  useAuthStore.getState().logout();
  push.mockReset();
  sessionStorage.clear();
  localStorage.clear();
  resetMockTwoFactor();
});

describe("useAuth — 2FA login", () => {
  describe("positive", () => {
    test("step 1 on a 2FA account returns twoFactorRequired, stores nothing, navigates nowhere", async () => {
      seedMockTwoFactor(true);
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.login(DEMO);
      });

      expect(outcome).toEqual({ twoFactorRequired: true });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().token).toBeNull();
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("negative", () => {
    test("an account without 2FA still logs in and lands as before", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.login(DEMO);
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(push).toHaveBeenCalledWith("/mint");
    });
  });
});
