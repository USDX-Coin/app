"use client";

// Penjaga 2FA uang keluar custodial (custodial-wallet.md §6.1, USDX-717) — satu
// tempat untuk transfer (`useTransfer`) dan redeem custodial (`useRedeem`), supaya
// kedua layar membaca aturan yang sama:
//
// - **Pra-cek 2FA.** `user.twoFactorEnabled === false` → kartu ajakan aktivasi, form
//   tidak bisa dikirim. Sumbernya salinan profil (pola `pinSet`): 401
//   TWO_FACTOR_SETUP_REQUIRED mengoreksinya ke `false`, dan aktivasi di
//   TwoFactorEnableDialog (USDX-714) mengembalikannya ke `true` — layar terbuka lagi
//   tanpa reload. `undefined` (sesi lama) tidak memblokir: backend yang menegakkan.
// - **Kunci 24 jam.** `GET /api/v2/wallet` `outboundLockedUntil`, atau
//   `details.lockedUntil` dari 409 CUSTODIAL_OUTBOUND_LOCKED (kunci terjadi saat form
//   terbuka). 409 menambal cache wallet supaya layar lain (Ringkasan redeem memegang
//   instans hook sendiri) ikut melihatnya. Kunci lepas sendiri saat waktunya lewat.
// - **Lockout kode** scope `2fa-stepup` punya hitung mundur sendiri; lockout PIN
//   (scope `pin`, atau tanpa scope dari backend lama) tetap milik pemanggil.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useProfileCorrection } from "@/hooks/useProfileCorrection";
import { useCustodialWallet, CUSTODIAL_WALLET_KEY } from "@/hooks/useCustodialWallet";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import {
  getLockoutScope,
  getOutboundLockedUntil,
  getRateLimitSeconds,
  isInvalidTwoFactorCode,
  isTooManyAttempts,
  isTwoFactorCodeRequired,
  isTwoFactorSetupRequired,
} from "@/lib/api/errors";
import type { CustodialWallet } from "@/types";

// setTimeout menyimpan jeda sebagai int32; kunci 24 jam jauh di bawahnya, ini hanya pagar.
const MAX_TIMER_MS = 2_147_483_647;

/** Kalimat di bawah kolom kode authenticator; null = bukan galat kode. */
export function stepUpErrorKey(error: unknown): string | null {
  if (isInvalidTwoFactorCode(error)) return "stepUp.errInvalid";
  if (isTwoFactorCodeRequired(error)) return "stepUp.errRequired";
  return null;
}

/** 429 TOO_MANY_ATTEMPTS milik PIN: scope `pin`, atau tanpa scope (backend sebelum USDX-718). */
export function isPinLockout(error: unknown): boolean {
  return isTooManyAttempts(error) && getLockoutScope(error) !== "2fa-stepup";
}

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export function useCustodialStepUp() {
  const twoFactorEnabled = useAuthStore((s) => s.user?.twoFactorEnabled);
  const correct = useProfileCorrection();
  const queryClient = useQueryClient();
  const wallet = useCustodialWallet();
  const cooldown = useCooldown();
  // Cadangan untuk 409 saat cache wallet belum terisi (tidak ada yang bisa ditambal).
  const [errorLockedUntil, setErrorLockedUntil] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const candidate = laterOf(wallet.wallet?.outboundLockedUntil ?? null, errorLockedUntil);
  const lockedUntil = candidate && Date.parse(candidate) > now ? candidate : null;

  // Bangun lagi tepat saat kunci lewat, supaya tombol kirim hidup tanpa reload.
  useEffect(() => {
    if (!lockedUntil) return;
    const ms = Math.min(Date.parse(lockedUntil) - Date.now(), MAX_TIMER_MS);
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, ms) + 50);
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  function onError(error: unknown) {
    if (isTwoFactorSetupRequired(error)) correct({ twoFactorEnabled: false });
    const until = getOutboundLockedUntil(error);
    if (until) {
      setErrorLockedUntil(until);
      setNow(Date.now());
      queryClient.setQueryData<CustodialWallet | null>(CUSTODIAL_WALLET_KEY, (old) =>
        old ? { ...old, outboundLockedUntil: until } : old,
      );
    }
    if (isTooManyAttempts(error) && !isPinLockout(error)) {
      cooldown.start(getRateLimitSeconds(error) || DEFAULT_COOLDOWN_SECONDS);
    }
  }

  return {
    /** Pemilik wallet belum mengaktifkan 2FA → ajakan aktivasi, form tidak bisa dikirim. */
    twoFactorSetupRequired: twoFactorEnabled === false,
    /** ISO 8601 selama transfer & redeem custodial ditahan; null bila tidak. */
    lockedUntil,
    /** Sisa detik lockout `2fa-stepup`. */
    twoFactorCooldownSeconds: cooldown.remaining,
    onError,
  };
}
