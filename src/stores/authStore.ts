import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  // Bearer credential (openapi AuthTokenV2.accessToken / sessionId). Auto-attached
  // by the API client on every authenticated request.
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  // Refresh the user object (e.g. after GET /api/v2/auth/me) without touching the token.
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: "usdx-auth",
    }
  )
);
