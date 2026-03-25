import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useAuth } from "@/hooks/useAuth";
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
          expect(result.current.loginError).toBe("Invalid email or password");
        });
      });
    });
  });

  describe("register", () => {
    describe("positive", () => {
      test("creates user and sets auth", async () => {
        const { result } = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.register({
            fullName: "Hook Test",
            email: `hook-${Date.now()}@test.com`,
            password: "HookTest1",
          });
        });

        expect(useAuthStore.getState().user?.fullName).toBe("Hook Test");
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
