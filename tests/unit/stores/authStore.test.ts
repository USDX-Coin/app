import { describe, test, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

const mockUser: User = {
  id: "usr_1",
  name: "Test User",
  email: "test@example.com",
  phone: "+628123456789",
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  describe("positive", () => {
    test("setAuth stores user and token", () => {
      useAuthStore.getState().setAuth(mockUser, "test-token");
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe("test-token");
      expect(state.isAuthenticated).toBe(true);
    });

    test("logout clears auth state", () => {
      useAuthStore.getState().setAuth(mockUser, "test-token");
      useAuthStore.getState().logout();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("negative", () => {
    test("initial state is not authenticated", () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe("persistence (CLNT-12, USDX-357)", () => {
    test("the session token is NEVER written to localStorage", () => {
      useAuthStore.getState().setAuth(mockUser, "secret-session-token");

      const raw = localStorage.getItem("usdx-auth");
      expect(raw).toBeTruthy();
      const persisted = JSON.parse(raw as string) as {
        state: { token?: unknown; user?: unknown; isAuthenticated?: unknown };
      };
      // Token stays in-memory only — a stolen localStorage snapshot yields no credential.
      expect(persisted.state.token ?? null).toBeNull();
      // Non-credential fields still persist so a reload doesn't flash the login screen.
      expect(persisted.state.user).toBeTruthy();
      expect(persisted.state.isAuthenticated).toBe(true);
    });

    test("the raw persisted blob does not contain the token string anywhere", () => {
      useAuthStore.getState().setAuth(mockUser, "super-secret-abc123");
      const raw = localStorage.getItem("usdx-auth") ?? "";
      expect(raw).not.toContain("super-secret-abc123");
    });

    test("setAuth still exposes the token in-memory for same-tab bearer fallback", () => {
      useAuthStore.getState().setAuth(mockUser, "in-mem-token");
      // In-memory state keeps the token (cross-site preview bearer fallback); only
      // persistence drops it.
      expect(useAuthStore.getState().token).toBe("in-mem-token");
    });
  });

  describe("edge cases", () => {
    test("double logout does not error", () => {
      useAuthStore.getState().logout();
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    test("setAuth overwrites previous auth", () => {
      useAuthStore.getState().setAuth(mockUser, "token-1");
      const newUser = { ...mockUser, id: "usr_2", name: "New User" };
      useAuthStore.getState().setAuth(newUser, "token-2");
      expect(useAuthStore.getState().user?.name).toBe("New User");
      expect(useAuthStore.getState().token).toBe("token-2");
    });
  });
});
