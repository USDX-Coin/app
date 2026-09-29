"use client";

// Koreksi salinan `user.pinSet` (users.yaml § User.pinSet, USDX-651) — satu
// tempat untuk tiga pemanggil: usePin (set sukses → true, REAUTH_REQUIRED →
// true, PIN_NOT_SET → false), useTransfer dan useRedeem (PIN_NOT_SET → false).
// Store + cache /auth/me ditulis lewat `useProfileCorrection` (alasannya di sana).

import { useCallback } from "react";
import { useProfileCorrection } from "@/hooks/useProfileCorrection";

export function usePinSetCorrection() {
  const correct = useProfileCorrection();
  return useCallback((pinSet: boolean) => correct({ pinSet }), [correct]);
}
