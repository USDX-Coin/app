import { describe, test, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

const mockUser: User = {
  id: "usr_1",
  fullName: "Test User",
  email: "test@example.com",
  isVerified: true,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("authStore", () => {
  beforeEach(() => {
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

  describe("edge cases", () => {
    test("double logout does not error", () => {
      useAuthStore.getState().logout();
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    test("setAuth overwrites previous auth", () => {
      useAuthStore.getState().setAuth(mockUser, "token-1");
      const newUser = { ...mockUser, id: "usr_2", fullName: "New User" };
      useAuthStore.getState().setAuth(newUser, "token-2");
      expect(useAuthStore.getState().user?.fullName).toBe("New User");
      expect(useAuthStore.getState().token).toBe("token-2");
    });
  });
});
