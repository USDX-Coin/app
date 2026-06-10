"use client";

// Refreshes the persisted user from GET /api/v2/auth/me on mount (USDX-150).
// localStorage holds the last-known user; this re-syncs kycStatus / emailVerifiedAt
// so guards act on fresh server state after a login or status change. A 401 is
// handled by the API client (clears session + redirects), so we swallow errors here.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/lib/api/auth-api";

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
