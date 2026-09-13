import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { afterVerifyEmailPath, useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

beforeEach(() => {
  useAuthStore.getState().logout();
});

describe("useAuth", () => {
  describe("login", () => {
    describe("positive", () => {
      test("sets auth state on successful login", async () => {
        const { result } = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.login({
            email: "demo@usdx.com",
            password: "Demo1234",
          });
        });

        expect(useAuthStore.getState().user?.email).toBe("demo@usdx.com");
        expect(useAuthStore.getState().token).toBeTruthy();
      });

      test("returns loginLoading during mutation", async () => {
        const { result } = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        });

        expect(result.current.loginLoading).toBe(false);
      });
    });

    describe("negative", () => {
      test("sets loginError on invalid credentials", async () => {
        const { result } = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          try {
            await result.current.login({
              email: "wrong@test.com",
              password: "wrong",
            });
          } catch {
            // Expected
          }
        });

        await waitFor(() => {
          expect(result.current.loginError?.message).toBe(
            "Invalid email or password"
          );
        });
      });
    });
  });

  describe("register", () => {
    describe("positive", () => {
      test("registers without issuing a session (must verify email first)", async () => {
        const { result } = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.register({
            email: `hook-${Date.now()}@test.com`,
            password: "HookTest1",
            confirmPassword: "HookTest1",
            phone: "081234567890",
            entityType: "INDIVIDUAL",
            agreeToS: true,
          });
        });

        // No auto-login on register — user stays unauthenticated until verify-email.
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
      });
    });
  });

  // USDX-566: verify-email is the first session a new account gets, so it lands
  // on the optional "dikasih wallet" step — unless the profile already carries
  // a custodial wallet (users.yaml § User.custodialWallet, the pinSet pattern).
  describe("afterVerifyEmailPath", () => {
    describe("positive", () => {
      test("a new account without a wallet lands on the onboarding step", () => {
        expect(afterVerifyEmailPath({ custodialWallet: null })).toBe("/onboarding/wallet");
      });

      test("an account that already has a wallet goes straight to the dashboard", () => {
        expect(
          afterVerifyEmailPath({ custodialWallet: { address: null, status: "PROVISIONING" } }),
        ).toBe("/mint");
      });
    });

    describe("negative", () => {
      test("no user at all (fallback link before the session lands) → onboarding", () => {
        expect(afterVerifyEmailPath(null)).toBe("/onboarding/wallet");
        expect(afterVerifyEmailPath(undefined)).toBe("/onboarding/wallet");
      });
    });

    describe("edge case", () => {
      test("a user object from before the field existed reads like 'no wallet'", () => {
        expect(afterVerifyEmailPath({})).toBe("/onboarding/wallet");
      });
    });
  });

  describe("logout", () => {
    describe("positive", () => {
      test("clears auth state", async () => {
        // First login
        const { result } = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.login({
            email: "demo@usdx.com",
            password: "Demo1234",
          });
        });

        expect(useAuthStore.getState().user).toBeTruthy();

        // Then logout
        act(() => {
          result.current.logout();
        });

        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().token).toBeNull();
      });
    });

    describe("edge cases", () => {
      test("handles logout when already logged out", () => {
        const { result } = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.logout();
        });

        expect(useAuthStore.getState().user).toBeNull();
      });
    });
  });
});
