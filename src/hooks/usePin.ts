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
// (401 PIN_NOT_SET = belum punya PIN; 401 REAUTH_REQUIRED = mengikuti
// `details.pinSet`, absen = sudah punya — USDX-697). Koreksi ditulis ke store DAN
// cache /auth/me sekaligus (`usePinSetCorrection`).

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
  getReauthPinSet,
  getFailureKey,
} from "@/lib/api/errors";

export interface PinError {
  /** Kolom tempat pesannya tampil: PIN lama, PIN baru, atau di atas form. */
  where: "current" | "new" | "form";
  key: string;
  /** Jalan keluarnya login ulang — dialog memasang tombol "Login ulang". */
  relogin?: true;
}

/** Jalur pemanggil `/set`: first-time set (bawaan) atau lupa-PIN (USDX-696). */
export type PinSetFlow = "set" | "reset";

// Pemetaan error set/change → kunci i18n + kolom. Diekspor untuk diuji tanpa
// React. `null` = tidak perlu pesan inline (429 → hitung mundur yang bicara).
// `flow` hanya membedakan REAUTH_REQUIRED — kode lain berarti sama di dua jalur.
export function mapPinError(error: unknown, flow: PinSetFlow = "set"): PinError | null {
  if (!error) return null;
  if (isTooManyAttempts(error)) return null;
  if (isInvalidPin(error)) return { where: "current", key: "pin.errInvalid" };
  if (isPinNotSet(error)) return { where: "form", key: "pin.errNotSet" };
  // Dua arti REAUTH_REQUIRED di first-time set (pin.yaml § set, USDX-697):
  // `details.pinSet: false` = akun ber-wallet custodial belum punya PIN dan
  // sesinya tidak segar → login ulang lalu buat PIN; selain itu = akun sudah
  // punya PIN → "gunakan Ubah PIN". Di jalur lupa-PIN (USDX-696) REAUTH_REQUIRED
  // berarti jendela sesi segar 5 menit lewat → login ulang (custodial-wallet.md §5.1).
  if (isReauthRequired(error)) {
    if (flow === "reset") return { where: "form", key: "pin.errReloginToReset", relogin: true };
    return getReauthPinSet(error) === false
      ? { where: "form", key: "pin.errReloginToCreate", relogin: true }
      : { where: "form", key: "pin.errAlreadySet" };
  }
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
    // Backend yang tahu apakah PIN ada; salinan profil mengikuti. Untuk
    // REAUTH_REQUIRED jawabannya `details.pinSet` — `false` tidak boleh dibalik ke
    // `true`: itu lingkaran "Ubah PIN" → PIN_NOT_SET → "Buat PIN" (USDX-697).
    const reauthPinSet = getReauthPinSet(error);
    if (reauthPinSet !== null) setPinSet(reauthPinSet);
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

  // Lupa PIN (custodial-wallet.md §5.1): `/set` yang sama, body `{pin}` tanpa
  // `currentPin` — sesi segar hasil login ulang yang membuktikan pemiliknya.
  // Mutasi sendiri supaya error-nya dipetakan dengan konteks jalur ini.
  const resetMutation = useMutation({
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
    resetPin: (pin: string) => resetMutation.mutateAsync(pin),
    isSettingPin: setMutation.isPending,
    isChangingPin: changeMutation.isPending,
    isResettingPin: resetMutation.isPending,
    setPinError: mapPinError(setMutation.error),
    changePinError: mapPinError(changeMutation.error),
    resetPinError: mapPinError(resetMutation.error, "reset"),
    resetErrors: () => {
      setMutation.reset();
      changeMutation.reset();
      resetMutation.reset();
    },
    /** Sisa detik lockout `pin`; > 0 → tombol simpan terkunci. */
    cooldownSeconds: cooldown.remaining,
  };
}
