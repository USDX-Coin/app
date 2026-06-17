"use client";

// Wires the API client's auth bindings to the auth store (USDX-150, extended
// USDX-205). Mounted once, app-wide, so any `apiFetch` call auto-attaches the
// Bearer token and reacts to cross-cutting auth states — without `client.ts`
// importing React or the store:
// - 401 → clear session + bounce to /login.
// - 403 ACCOUNT_SUSPENDED → clear session + bounce to a dedicated /suspended
//   screen. This can surface on *any* authenticated consumer call (base
//   ConsumerAuthGuard), e.g. a mid-session suspension caught on the /me refresh.
//   Other 403 gating codes (EMAIL_NOT_VERIFIED / KYC_NOT_VERIFIED) are handled
//   inline per page, so they're intentionally ignored here.

import { useEffect } from "react";
import { configureApiClient } from "@/lib/api/client";
import { useAuthStore } from "@/stores/authStore";

const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

export function ApiClientBridge() {
  useEffect(() => {
    configureApiClient({
      getToken: () => useAuthStore.getState().token,
      onUnauthorized: () => {
        if (!useAuthStore.getState().isAuthenticated) return;
        useAuthStore.getState().logout();
        const path = window.location.pathname;
        const onPublicPage = PUBLIC_PREFIXES.some((p) => path.startsWith(p));
        if (!onPublicPage) window.location.assign("/login");
      },
      onForbidden: (code) => {
        if (code !== "ACCOUNT_SUSPENDED") return;
        if (!useAuthStore.getState().isAuthenticated) return;
        useAuthStore.getState().logout();
        if (window.location.pathname !== "/suspended") window.location.assign("/suspended");
      },
    });
  }, []);

  return null;
}
