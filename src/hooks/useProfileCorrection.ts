"use client";

// Koreksi bendera profil yang dibaca layar uang — `pinSet` (USDX-651) dan
// `twoFactorEnabled` (USDX-714). Satu penulis untuk semua pemanggil.
//
// Store DAN cache `["session", "me"]` ditulis bersamaan. Store saja tidak cukup:
// `/send` dan `/redeem` tidak memasang `useSession`, jadi `invalidateQueries`
// tidak me-refetch apa pun, dan salinan `/auth/me` lama yang masih di cache
// (Pengaturan / Profil / KYC, gcTime 5 menit, staleTime 60 detik) ditulis balik
// ke store begitu layar ber-`useSession` dibuka lagi — menetap kalau refetch-nya
// gagal (custodial-wallet.md §5.1 "PIN di web"; ditemukan review PR app#75;
// users.yaml § User.twoFactorEnabled).

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore, type ProfileFlags } from "@/stores/authStore";
import type { User } from "@/types";

export function useProfileCorrection() {
  const patchUser = useAuthStore((s) => s.patchUser);
  const queryClient = useQueryClient();

  return useCallback(
    (patch: ProfileFlags) => {
      patchUser(patch);
      queryClient.setQueryData<User>(["session", "me"], (old) => (old ? { ...old, ...patch } : old));
    },
    [patchUser, queryClient],
  );
}
