import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { markReloginIntent, reloginLanding } from "@/lib/auth/relogin-intent";
import {
  MOCK_RECOVERY_OTP,
  MOCK_TOTP_CODE,
  isMockTwoFactorEnabled,
  resetMockTwoFactor,
  seedMockTwoFactor,
} from "@/lib/api/mock-two-factor";

// Login on an account with 2FA (auth.yaml § loginV2, USDX-714): step 1 is NOT a
// login — no session in the store, no navigation; the caller shows the code step.
// Step 2 (verify-login) is the login: session + the same landing as a plain login,
// the re-login intent included (lupa-PIN / Buat PIN, USDX-696/697).

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

  describe("positive — step 2", () => {
    async function stepOne() {
      seedMockTwoFactor(true);
      const hook = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await act(async () => {
        await hook.result.current.login(DEMO);
      });
      return hook.result;
    }

    test("the right code stores the session and lands on /mint", async () => {
      const result = await stepOne();
      await act(async () => {
        await result.current.verifyTwoFactorLogin(MOCK_TOTP_CODE);
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.email).toBe(DEMO.email);
      expect(push).toHaveBeenCalledWith("/mint");
    });

    test("a re-login intent (forgot PIN) still lands on its screen after the code", async () => {
      markReloginIntent("forgot-pin");
      const result = await stepOne();
      await act(async () => {
        await result.current.verifyTwoFactorLogin(MOCK_TOTP_CODE);
      });
      expect(push).toHaveBeenCalledWith("/settings");
      expect(reloginLanding()).toBe("/settings");
    });

    test("email recovery: send the OTP, verify it → 2FA off, still no session (log in again)", async () => {
      const result = await stepOne();
      await act(async () => {
        await result.current.requestTwoFactorRecovery();
        await result.current.confirmTwoFactorRecovery(MOCK_RECOVERY_OTP);
      });
      expect(isMockTwoFactorEnabled()).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("negative", () => {
    test("a wrong code rejects, stores nothing, navigates nowhere", async () => {
      seedMockTwoFactor(true);
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.login(DEMO);
      });
      await act(async () => {
        await expect(result.current.verifyTwoFactorLogin("000000")).rejects.toMatchObject({
          code: "INVALID_TWO_FACTOR_CODE",
        });
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(push).not.toHaveBeenCalled();
    });

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
