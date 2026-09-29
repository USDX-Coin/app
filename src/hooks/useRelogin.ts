"use client";

// Tombol "Login ulang" (custodial-wallet.md §5.1 "PIN di web" + "Lupa PIN di web";
// USDX-697, alur yang sama dipakai USDX-696). Beberapa aksi PIN butuh sesi
// password-auth SEGAR (< 5 menit, pin.yaml § set); satu-satunya cara FE
// mendapatkannya adalah login lagi. Urutannya: tandai niat (sebelum store
// kosong, supaya layar login sudah bisa membacanya) → cabut sesi ini di backend
// (fire-and-forget, pola logout Sidebar — jaringan mati tidak boleh menjebak user)
// → kosongkan store → halaman login. Login berikutnya mendarat di layar niat itu
// (useAuth + lib/auth/relogin-intent).

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { logout as revokeSession } from "@/lib/api/auth-api";
import { markReloginIntent, type ReloginIntent } from "@/lib/auth/relogin-intent";

export function useRelogin() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return useCallback(
    (intent: ReloginIntent) => {
      markReloginIntent(intent);
      revokeSession().catch(() => {});
      logout();
      router.push("/login");
    },
    [logout, router],
  );
}
