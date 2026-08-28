import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  // The consumer profile. IN-MEMORY only — it never reaches localStorage, because
  // `name` / `email` / `phone` are the customer's personal data and the backend
  // already stores `users.phone` encrypted at rest. Writing it back out in clear on
  // the device would undo that. Repopulated on every app load from
  // GET /api/v2/auth/me (`useSession`, mounted by the dashboard layout); `null`
  // means "not answered yet", never "not verified" — see `lib/auth/guards.ts`.
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
      // ONE key on the device, and it is a rendering hint — not a security claim.
      //
      // `isAuthenticated` answers a single question the UI has to answer before the
      // server can: which page skeleton do I draw, the dashboard shell or the login
      // form. Authority stays where it already was — the httpOnly session cookie and
      // the server. Someone who edits this value to `true` in devtools gets an empty
      // shell and nothing else: every byte of content on it (identity, KYC status,
      // balances, orders) is fetched with the cookie, so a forged flag buys a
      // skeleton and a redirect back to /login on the first 401. Do NOT "harden" this
      // by signing it or moving it server-side; there is nothing here to protect.
      //
      // What is deliberately NOT here:
      //  - `token` — a credential in localStorage is stealable by XSS (USDX-357 /
      //    WSTG-CLNT-12).
      //  - `user` — name / email / phone are the customer's personal data. They are
      //    needed only to DISPLAY, and display can wait for /api/v2/auth/me. Keeping
      //    them out means a device backup, a borrowed laptop or a browser extension
      //    finds nothing at rest, without the victim ever opening the app. (This does
      //    not defeat XSS: script running on the page can still call /auth/me with
      //    the victim's cookie. It removes the data that just sits there.)
      //
      // Encrypting the blob was rejected — the key would ship to the same device.
      // sessionStorage was rejected — the same script reads it just as easily.
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    }
  )
);
