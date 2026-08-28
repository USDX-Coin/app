"use client";

// Loads the consumer profile from GET /api/v2/auth/me (USDX-150). The user object
// is never persisted, so this is the ONLY source of the customer's identity, KYC
// status and emailVerifiedAt — which is why the dashboard layout mounts it on app
// load rather than leaving it to the KYC pages. A 401 is handled by the API client
// (clears session + redirects), so we swallow errors here.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/lib/api/auth-api";
import type { User } from "@/types";

export function useSession() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery({
    queryKey: ["session", "me"],
    queryFn: getMe,
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}

// Read the profile together with whether it is merely still on its way.
//
// `loading` is true exactly while the app knows it has a session but not yet WHO —
// the window that opened when the user object stopped being persisted. Callers must
// render a skeleton in that window; they must not redirect, lock an action, or
// print a fallback that reads as a verdict ("Unverified", "-").
//
// If the refresh fails without a 401 (offline, 5xx), `user` stays null and the
// skeleton stays up. That is deliberate: a stale-looking screen the customer can
// reload is a much cheaper failure than telling a verified customer they are not.
export function useSessionUser(): { user: User | null; loading: boolean } {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return { user, loading: isAuthenticated && user === null };
}
