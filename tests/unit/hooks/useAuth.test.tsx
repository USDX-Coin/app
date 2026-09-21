import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { markReloginIntent, reloginLanding } from "@/lib/auth/relogin-intent";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
  }),
}));

beforeEach(() => {
  useAuthStore.getState().logout();
  push.mockReset();
  sessionStorage.clear();
});

async function loginAsDemo(result: { current: ReturnType<typeof useAuth> }) {
  await act(async () => {
    await result.current.login({ email: "demo@usdx.com", password: "Demo1234" });
  });
}

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

      test("lands on /mint without a re-login intent", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
        await loginAsDemo(result);
        expect(push).toHaveBeenCalledWith("/mint");
      });

      // "Login ulang" dari dialog Buat PIN (USDX-697, custodial-wallet.md §5.1):
      // sesudah login user kembali ke layar niatnya, bukan ke /mint. Penanda tetap
      // ada untuk diambil layar tujuan (yang membuka dialognya).
      test("a create-pin re-login intent lands on /settings and is left for that screen to take", async () => {
        markReloginIntent("create-pin");
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
        await loginAsDemo(result);
        expect(push).toHaveBeenCalledWith("/settings");
        expect(reloginLanding()).toBe("/settings");
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

      test("a failed login does not navigate and keeps the re-login intent for the next try", async () => {
        markReloginIntent("create-pin");
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
        await act(async () => {
          await result.current.login({ email: "demo@usdx.com", password: "wrong" }).catch(() => undefined);
        });
        expect(push).not.toHaveBeenCalled();
        expect(reloginLanding()).toBe("/settings");
      });
    });

    describe("edge case", () => {
      // The marker is read from storage anyone on the page can write: a value that
      // is not a known intent must never become a redirect target.
      test("a foreign value in the re-login marker is ignored — login lands on /mint", async () => {
        sessionStorage.setItem("usdx-relogin-intent", "https://evil.example");
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
        await loginAsDemo(result);
        expect(push).toHaveBeenCalledWith("/mint");
        expect(push).not.toHaveBeenCalledWith("https://evil.example");
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
