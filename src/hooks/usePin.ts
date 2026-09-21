"use client";

// Buat / ubah PIN akun (pin.yaml § set / change, USDX-651). PIN adalah
// satu-satunya titik persetujuan transfer & redeem custodial
// (custodial-wallet.md §5.1/§5.3), dan tanpa layar ini user web tidak pernah
// bisa memilikinya.
//
// Dua mutasi + satu cooldown (lockout scope `pin` dibagi set/change/transfer/
// redeem) + pemetaan error ke KOLOM, bukan ke toast: PIN lama salah tampil di
// bawah kolom PIN lama, PIN baru yang sama tampil di bawah kolom PIN baru.
//
// Salinan `user.pinSet` di store adalah satu-satunya sumber yang dibaca layar
// uang (`useCustodialWallet.pinSet`) — hook ini yang mengoreksinya seketika:
// `true` begitu set sukses (dialog PIN transfer/redeem langsung terbuka, tanpa
// menunggu /auth/me), dan mengikuti backend saat salinan ternyata basi
// (401 REAUTH_REQUIRED = akun sudah punya PIN; 401 PIN_NOT_SET = belum). Koreksi
// ditulis ke store DAN cache /auth/me sekaligus (`usePinSetCorrection`).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { usePinSetCorrection } from "@/hooks/usePinSetCorrection";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { setPin as apiSetPin, changePin as apiChangePin } from "@/lib/api/auth-api";
import type { ChangePinRequest } from "@/lib/api/types";
import {
  isInvalidPin,
  isPinNotSet,
  isPinUnchanged,
  isReauthRequired,
  isTooManyAttempts,
  isValidationError,
  getRateLimitSeconds,
  getFailureKey,
} from "@/lib/api/errors";

export interface PinError {
  /** Kolom tempat pesannya tampil: PIN lama, PIN baru, atau di atas form. */
  where: "current" | "new" | "form";
  key: string;
}

// Pemetaan error set/change → kunci i18n + kolom. Diekspor untuk diuji tanpa
// React. `null` = tidak perlu pesan inline (429 → hitung mundur yang bicara).
export function mapPinError(error: unknown): PinError | null {
  if (!error) return null;
  if (isTooManyAttempts(error)) return null;
  if (isInvalidPin(error)) return { where: "current", key: "pin.errInvalid" };
  if (isPinNotSet(error)) return { where: "form", key: "pin.errNotSet" };
  if (isReauthRequired(error)) return { where: "form", key: "pin.errAlreadySet" };
  if (isPinUnchanged(error)) return { where: "new", key: "pin.errUnchanged" };
  if (isValidationError(error)) return { where: "new", key: "pin.errFormat" };
  return { where: "form", key: getFailureKey(error) ?? "pin.errFailed" };
}

export function usePin() {
  const user = useAuthStore((s) => s.user);
  const setPinSet = usePinSetCorrection();
  const queryClient = useQueryClient();
  const cooldown = useCooldown();

  function onError(error: unknown) {
    if (isTooManyAttempts(error)) {
      cooldown.start(getRateLimitSeconds(error) || DEFAULT_COOLDOWN_SECONDS);
    }
    // Backend yang tahu apakah PIN ada; salinan profil mengikuti.
    if (isReauthRequired(error)) setPinSet(true);
    if (isPinNotSet(error)) setPinSet(false);
  }

  function onSuccess() {
    setPinSet(true);
    // Sukses set mereset lockout `pin` (pin.yaml § set); hitung mundur ikut berhenti.
    cooldown.start(0);
    // Segarkan salinan resmi di latar — nilai di store sudah benar sejak sekarang.
    void queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  }

  const setMutation = useMutation({
    mutationFn: (pin: string) => apiSetPin({ pin }),
    onSuccess,
    onError,
  });

  const changeMutation = useMutation({
    mutationFn: (req: ChangePinRequest) => apiChangePin(req),
    onSuccess,
    onError,
  });

  return {
    /** `false` = belum punya PIN; `null` = sesi lama yang belum membawa field ini. */
    pinSet: typeof user?.pinSet === "boolean" ? user.pinSet : null,
    setPin: (pin: string) => setMutation.mutateAsync(pin),
    changePin: (req: ChangePinRequest) => changeMutation.mutateAsync(req),
    isSettingPin: setMutation.isPending,
    isChangingPin: changeMutation.isPending,
    setPinError: mapPinError(setMutation.error),
    changePinError: mapPinError(changeMutation.error),
    resetErrors: () => {
      setMutation.reset();
      changeMutation.reset();
    },
    /** Sisa detik lockout `pin`; > 0 → tombol simpan terkunci. */
    cooldownSeconds: cooldown.remaining,
  };
}
