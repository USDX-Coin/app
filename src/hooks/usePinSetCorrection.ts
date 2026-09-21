"use client";

// Koreksi salinan `user.pinSet` (users.yaml § User.pinSet, USDX-651) — satu
// tempat untuk tiga pemanggil: usePin (set sukses → true, REAUTH_REQUIRED →
// true, PIN_NOT_SET → false), useTransfer dan useRedeem (PIN_NOT_SET → false).
//
// Store DAN cache `["session", "me"]` ditulis bersamaan. Store saja tidak cukup:
// `/send` dan `/redeem` tidak memasang `useSession`, jadi `invalidateQueries`
// tidak me-refetch apa pun, dan salinan `/auth/me` lama yang masih di cache
// (Pengaturan / Profil / KYC, gcTime 5 menit, staleTime 60 detik) ditulis balik
// ke store begitu layar ber-`useSession` dibuka lagi — menetap kalau refetch-nya
// gagal (custodial-wallet.md §5.1 "PIN di web"; ditemukan review PR app#75).

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

export function usePinSetCorrection() {
  const setPinSet = useAuthStore((s) => s.setPinSet);
  const queryClient = useQueryClient();

  return useCallback(
    (pinSet: boolean) => {
      setPinSet(pinSet);
      queryClient.setQueryData<User>(["session", "me"], (old) => (old ? { ...old, pinSet } : old));
    },
    [setPinSet, queryClient],
  );
}
