import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  // Bearer credential (openapi AuthTokenV2.accessToken / sessionId). Kept IN-MEMORY
  // only — never persisted (USDX-357 / WSTG-CLNT-12: a token in localStorage is
  // stealable via XSS). Authenticated requests ride the httpOnly session cookie
  // (`credentials: "include"`); this in-memory bearer is only a same-tab fallback for
  // cross-site previews where the cookie isn't delivered. Gone on reload → cookie takes over.
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
      // CLNT-12: persist only non-credential UX state. `token` is deliberately excluded
      // so it never reaches localStorage; `user`/`isAuthenticated` persist so a reload
      // doesn't flash the login screen while the cookie re-authenticates in the background.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
