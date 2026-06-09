"use client";

// Wires the API client's auth bindings to the auth store (USDX-150). Mounted once,
// app-wide, so any `apiFetch` call auto-attaches the Bearer token and a 401 clears
// the session + bounces to /login — without `client.ts` importing React or the store.

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
    });
  }, []);

  return null;
}
