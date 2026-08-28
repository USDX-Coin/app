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
import { isUnreachable } from "@/lib/api/errors";
import type { User } from "@/types";

// One key, one request: `useSession` (the fetcher, mounted by the dashboard layout)
// and every `useSessionUser` reader share this cache entry, so readers observe the
// same in-flight/error state without firing a second call.
const SESSION_QUERY_KEY = ["session", "me"] as const;

function sessionQueryOptions(isAuthenticated: boolean) {
  return {
    queryKey: SESSION_QUERY_KEY,
    queryFn: getMe,
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  };
}

export function useSession() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery(sessionQueryOptions(isAuthenticated));

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}

// Read the profile together with WHY it is not here, when it is not here.
//
// `loading` — the app knows it has a session but not yet who. Callers render a
//   skeleton; they must not redirect, lock an action, or print a fallback that reads
//   as a verdict ("Unverified", "-"). It is momentary and needs no explanation.
//
// `unreachable` — same missing data, but the fetch has already failed with something
//   other than a 401, so it is not coming without a reload. `loading` deliberately
//   stays true alongside it: the skeleton is still the honest thing to show, and a
//   stale-looking screen the customer can reload is far cheaper than telling a
//   verified customer they are not. What changes is that callers may now say why.
export function useSessionUser(): {
  user: User | null;
  loading: boolean;
  unreachable: boolean;
} {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { error } = useQuery(sessionQueryOptions(isAuthenticated));

  const missing = isAuthenticated && user === null;
  return { user, loading: missing, unreachable: missing && isUnreachable(error) };
}
