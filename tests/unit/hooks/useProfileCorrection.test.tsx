import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProfileCorrection } from "@/hooks/useProfileCorrection";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

// The one writer of a profile-flag correction (`pinSet` USDX-651, `twoFactorEnabled`
// USDX-714): store AND the `["session","me"]` cache, so a screen that remounts
// `useSession` cannot write a stale cached /auth/me back over it (lesson from the
// app#75 review — /send reads the store without refetching /auth/me).

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
  twoFactorEnabled: false,
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["session", "me"], USER);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useProfileCorrection(), { wrapper });
  return { queryClient, correct: result.current };
}

beforeEach(() => {
  useAuthStore.getState().setAuth(USER, "tok");
});

describe("useProfileCorrection", () => {
  describe("positive", () => {
    test("twoFactorEnabled lands in the store and the /auth/me cache, the rest untouched", () => {
      const { queryClient, correct } = setup();
      act(() => correct({ twoFactorEnabled: true }));

      expect(useAuthStore.getState().user).toEqual({ ...USER, twoFactorEnabled: true });
      expect(queryClient.getQueryData(["session", "me"])).toEqual({ ...USER, twoFactorEnabled: true });
      expect(useAuthStore.getState().token).toBe("tok");
    });

    test("pinSet goes through the same writer", () => {
      const { queryClient, correct } = setup();
      act(() => correct({ pinSet: false }));

      expect(useAuthStore.getState().user?.pinSet).toBe(false);
      expect(queryClient.getQueryData<User>(["session", "me"])?.pinSet).toBe(false);
    });
  });

  describe("negative", () => {
    test("no user, no cache → nothing is invented", () => {
      useAuthStore.getState().logout();
      const queryClient = new QueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(() => useProfileCorrection(), { wrapper });

      act(() => result.current({ twoFactorEnabled: true }));

      expect(useAuthStore.getState().user).toBeNull();
      expect(queryClient.getQueryData(["session", "me"])).toBeUndefined();
    });
  });

  describe("edge case", () => {
    test("a stale cached /auth/me can no longer undo the correction", () => {
      const { queryClient, correct } = setup();
      act(() => correct({ twoFactorEnabled: true }));
      // What useSession does when it remounts: copy the cached /auth/me into the store.
      useAuthStore.getState().setUser(queryClient.getQueryData<User>(["session", "me"])!);
      expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(true);
    });
  });
});
