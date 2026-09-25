"use client";

// 2FA di Pengaturan (two-factor.yaml, USDX-714): aktifkan (password → QR + backup
// code → kode), matikan (password ATAU kode), regenerate backup code. 2FA WAJIB
// untuk uang keluar custodial (custodial-wallet.md §6.1), dan sebelum tiket ini
// web tidak punya jalan untuk mengaktifkannya.
//
// Salinan `user.twoFactorEnabled` di store adalah yang dibaca layar uang
// (USDX-717) — hook ini mengoreksinya seketika lewat `useProfileCorrection`
// (store + cache /auth/me): `true` saat verify sukses, `false` saat disable sukses
// atau backend menjawab TWO_FACTOR_NOT_ENABLED (salinan basi). /auth/me juga
// disegarkan di latar.
//
// Satu hitung mundur untuk lockout `2fa-verify` (dibagi enable/verify/disable/
// regenerate di backend) + satu error terakhir yang dipetakan ke tempatnya:
// kolom password, kolom kode, atau di atas form.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useProfileCorrection } from "@/hooks/useProfileCorrection";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import {
  disableTwoFactor,
  enableTwoFactor,
  regenerateBackupCodes,
  verifyTwoFactor,
} from "@/lib/api/two-factor-api";
import {
  getFailureKey,
  getRateLimitSeconds,
  isInvalidCredentials,
  isInvalidTwoFactorCode,
  isTwoFactorNotEnabled,
  isValidationError,
} from "@/lib/api/errors";
import type { DisableTwoFactorRequest } from "@/lib/api/types";

export interface TwoFactorError {
  where: "password" | "code" | "form";
  key: string;
}

// Diekspor untuk diuji tanpa React. `null` = tidak perlu pesan inline (429 →
// hitung mundur yang bicara).
export function mapTwoFactorError(error: unknown): TwoFactorError | null {
  if (!error) return null;
  if (getRateLimitSeconds(error) !== null) return null;
  if (isInvalidCredentials(error)) return { where: "password", key: "twoFactor.errPassword" };
  if (isInvalidTwoFactorCode(error)) return { where: "code", key: "twoFactor.errCode" };
  if (isValidationError(error)) return { where: "code", key: "twoFactor.errCodeFormat" };
  if (isTwoFactorNotEnabled(error)) return { where: "form", key: "twoFactor.errNotEnabled" };
  return { where: "form", key: getFailureKey(error) ?? "twoFactor.errFailed" };
}

export function useTwoFactor() {
  const user = useAuthStore((s) => s.user);
  const correct = useProfileCorrection();
  const queryClient = useQueryClient();
  const cooldown = useCooldown();
  const [lastError, setLastError] = useState<unknown>(null);

  function onError(error: unknown) {
    setLastError(error);
    const retryAfter = getRateLimitSeconds(error);
    if (retryAfter !== null) cooldown.start(retryAfter || DEFAULT_COOLDOWN_SECONDS);
    if (isTwoFactorNotEnabled(error)) correct({ twoFactorEnabled: false });
  }

  function settled(twoFactorEnabled?: boolean) {
    setLastError(null);
    cooldown.start(0);
    if (twoFactorEnabled === undefined) return;
    correct({ twoFactorEnabled });
    void queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  }

  const enableMutation = useMutation({
    mutationFn: (password: string) => enableTwoFactor({ password }),
    onSuccess: () => settled(),
    onError,
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => verifyTwoFactor({ code }),
    onSuccess: () => settled(true),
    onError,
  });

  const disableMutation = useMutation({
    mutationFn: (req: DisableTwoFactorRequest) => disableTwoFactor(req),
    onSuccess: () => settled(false),
    onError,
  });

  const regenerateMutation = useMutation({
    mutationFn: (password: string) => regenerateBackupCodes({ password }),
    onSuccess: () => settled(),
    onError,
  });

  return {
    /** `null` = sesi lama yang belum membawa field ini (tidak dibaca sebagai "mati"). */
    twoFactorEnabled:
      typeof user?.twoFactorEnabled === "boolean" ? user.twoFactorEnabled : null,
    enable: enableMutation.mutateAsync,
    verify: verifyMutation.mutateAsync,
    disable: disableMutation.mutateAsync,
    regenerate: regenerateMutation.mutateAsync,
    isEnabling: enableMutation.isPending,
    isVerifying: verifyMutation.isPending,
    isDisabling: disableMutation.isPending,
    isRegenerating: regenerateMutation.isPending,
    error: mapTwoFactorError(lastError),
    resetError: () => setLastError(null),
    /** Sisa detik lockout `2fa-verify`; > 0 → tombol terkunci. */
    cooldownSeconds: cooldown.remaining,
  };
}
