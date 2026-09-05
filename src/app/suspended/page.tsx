"use client";

// Dedicated full-screen notice for a suspended account (USDX-205). The API
// client bridge routes here on a 403 ACCOUNT_SUSPENDED from any authenticated
// consumer call. Public route (outside the dashboard guard) so it renders after
// the session is cleared.
//
// The screen itself lives in `auth/SuspendedNotice` — it is board 37, and it is
// also reachable from "Lihat penjelasan" on the login error, so it cannot be a
// page-local layout.

import { SuspendedNotice } from "@/components/auth/SuspendedNotice";

export default function SuspendedPage() {
  return <SuspendedNotice />;
}
