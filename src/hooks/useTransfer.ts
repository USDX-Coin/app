"use client";

// Transfer USDX dari wallet custodial (USDX-567, wallet.yaml § POST
// /api/v2/wallet/transfer, custodial-wallet.md §5.1). Menggabungkan
// transferStore + useCustodialWallet (address & saldo) + validasi + mutasi.
//
// Urutan di layar: form → Ringkasan (modal) → dialog PIN → 202 → tampilan hasil
// (tx hash + explorer). PIN adalah bagian body, jadi mutasi baru berangkat dari
// dialog PIN (`submitWithPin`).
//
// Yang menjadikan hook ini lebih dari form biasa adalah `Idempotency-Key`:
//   - dibuat SEKALI per niat (transferStore.ensureIdempotencyKey), dipakai ulang
//     oleh semua retry — salah PIN, 503 (termasuk NETWORK_CONGESTED), jaringan
//     putus — dan dibuang hanya saat user mengubah tujuan/jumlah (store yang
//     menjaga itu);
//   - 409 IDEMPOTENCY_KEY_IN_PROGRESS → tunggu lalu coba lagi dengan key yang
//     SAMA (bukan transfer baru) beberapa kali; kalau masih berjalan, user
//     diberi tahu dan tombol kirim memakai key yang sama lagi;
//   - 409 IDEMPOTENCY_KEY_REUSED = bug FE (key tidak dibuat ulang saat body
//     berubah). Key dibuang + dilaporkan ke console, user mendapat pesan generik.
//
// Error dipilah ke dua tempat: yang menyangkut PIN (`pinErrorKey`, `pinNotSet`,
// `pinCooldownSeconds`) tetap di dialog PIN supaya user mengetik ulang di situ;
// yang lain (`errorKey`) menutup dialog PIN dan tampil di Ringkasan, di samping
// angka yang menghasilkannya. 429 RATE_LIMITED dibiarkan ke toast global.
//
// 2FA (custodial-wallet.md §6.1, USDX-717): kode authenticator ikut di body yang
// sama (`twoFactorCode`) dan BUKAN identitas niat — mengganti kode setelah salah
// memakai key yang sama. Galat kode (`twoFactorErrorKey`, lockout `2fa-stepup`)
// tetap di dialog PIN; 401 TWO_FACTOR_SETUP_REQUIRED dan 409 CUSTODIAL_OUTBOUND_LOCKED
// (`where: "guard"`) menutup dialog dan tampil lewat kartu ajakan / banner kunci
// milik `useCustodialStepUp`, bukan kalimat galat Ringkasan.
//
// `pinNotSet` dibaca dari salinan profil `user.pinSet` saja (USDX-651): 401
// PIN_NOT_SET mengoreksi salinan itu ke `false`, dan PinSetupDialog (dibuka dari
// notice) mengembalikannya ke `true` — dialog PIN lalu terbuka lagi tanpa
// state lokal yang harus disinkronkan.

import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTransferStore } from "@/stores/transferStore";
import { usePinSetCorrection } from "@/hooks/usePinSetCorrection";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { useCustodialStepUp, stepUpErrorKey, isPinLockout } from "@/hooks/useCustodialStepUp";
import { TRANSACTIONS_KEY } from "@/hooks/useTransactions";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { transferCustodial } from "@/lib/api/wallet-api";
import {
  validateTransferAddress,
  validateTransferAmount,
  normalizeTransferAmount,
} from "@/lib/validations";
import { parseAmount, formatAmount, formatDateTime } from "@/lib/utils";
import {
  isApiError,
  isValidationError,
  isRateLimited,
  isInvalidPin,
  isPinNotSet,
  isTooManyAttempts,
  isTwoFactorSetupRequired,
  isCustodialOutboundLocked,
  isWalletNotActive,
  isWalletNotFound,
  isWalletServiceUnavailable,
  isNetworkCongested,
  isIdempotencyKeyInProgress,
  isIdempotencyKeyReused,
  isRecipientBlacklisted,
  isInsufficientBalance,
  isTransferLimitExceeded,
  getTransferLimitDetails,
  getRateLimitSeconds,
  getFailureKey,
} from "@/lib/api/errors";
import type { CustodialWalletStatus } from "@/types";

// Berapa lama menunggu sebelum mencoba lagi dengan key yang sama saat backend
// menjawab IN_PROGRESS, dan berapa kali. Tx Polygon masuk blok ~2 s; lebih dari
// ini user lebih baik diberi tahu daripada menatap spinner.
export const IN_PROGRESS_RETRY_MS = 1_500;
export const IN_PROGRESS_MAX_RETRIES = 4;

export interface TransferError {
  /**
   * Di mana pesannya tampil: kolom PIN (`pin`), kolom kode authenticator
   * (`twoFactor`), Ringkasan (`form`), atau kartu ajakan 2FA / banner kunci milik
   * `useCustodialStepUp` (`guard` — tidak ada kalimat galat tambahan).
   */
  where: "pin" | "twoFactor" | "form" | "guard";
  key: string;
  vars?: Record<string, string>;
}

// Kata status untuk pesan 409 WALLET_NOT_ACTIVE. Salinan profil bisa basi (backend
// menolak padahal profil masih ACTIVE) → "belum aktif", sambil status di-refetch.
export function walletStatusKey(status: CustodialWalletStatus | "none" | null): string {
  if (status === "SUSPENDED") return "wallet.status.SUSPENDED";
  if (status === "PROVISIONING") return "wallet.status.PROVISIONING";
  return "wallet.status.notActive";
}

// Pemetaan error create → kunci i18n + lokasi tampil. Diekspor untuk diuji tanpa
// React. `null` = tidak perlu pesan inline (RATE_LIMITED → toast global).
export function mapTransferError(
  error: unknown,
  t: (key: string, vars?: Record<string, string>) => string,
  walletStatus: CustodialWalletStatus | null,
  lang: "id" | "en" = "id",
): TransferError | null {
  if (!error) return null;
  if (isRateLimited(error)) return null;
  if (isInvalidPin(error)) return { where: "pin", key: "pin.errInvalid" };
  if (isPinNotSet(error)) return { where: "pin", key: "pin.errNotSet" };
  if (isPinLockout(error)) return { where: "pin", key: "pin.errLocked" };
  if (isTooManyAttempts(error)) return { where: "twoFactor", key: "stepUp.errLocked" };
  const codeKey = stepUpErrorKey(error);
  if (codeKey) return { where: "twoFactor", key: codeKey };
  if (isTwoFactorSetupRequired(error)) return { where: "guard", key: "stepUp.setupRequiredSend" };
  if (isCustodialOutboundLocked(error)) return { where: "guard", key: "stepUp.locked" };
  if (isWalletNotActive(error)) {
    return {
      where: "form",
      key: "transfer.errWalletNotActive",
      vars: { status: t(walletStatusKey(walletStatus)) },
    };
  }
  if (isTransferLimitExceeded(error)) {
    const d = getTransferLimitDetails(error);
    if (d?.limitType === "PER_TX") {
      return { where: "form", key: "transfer.errLimitPerTx", vars: { limit: formatAmount(Number(d.limit)) } };
    }
    if (d?.limitType === "DAILY") {
      return {
        where: "form",
        key: "transfer.errLimitDaily",
        vars: {
          limit: formatAmount(Number(d.limit)),
          remaining: formatAmount(Number(d.remaining)),
          resetAt: d.resetAt ? formatDateTime(d.resetAt, lang) : "—",
        },
      };
    }
    // `details` tidak berbentuk seperti kontrak → kalimat netral, bukan menebak jenisnya.
    return { where: "form", key: "transfer.errLimitGeneric" };
  }
  if (isRecipientBlacklisted(error)) return { where: "form", key: "transfer.errBlacklisted" };
  if (isInsufficientBalance(error)) return { where: "form", key: "transfer.errInsufficient" };
  if (isValidationError(error)) return { where: "form", key: "transfer.errValidation" };
  if (isWalletNotFound(error)) return { where: "form", key: "transfer.errNoWallet" };
  if (isWalletServiceUnavailable(error)) return { where: "form", key: "transfer.errServiceUnavailable" };
  // Fee jaringan di atas plafon: ditolak sebelum tanda tangan. Kunci TIDAK dibuang —
  // kontraknya "aman di-retry dengan key yang SAMA" (USDX-709).
  if (isNetworkCongested(error)) return { where: "form", key: "transfer.errNetworkCongested" };
  if (isIdempotencyKeyInProgress(error)) return { where: "form", key: "transfer.errInProgress" };
  if (isIdempotencyKeyReused(error)) return { where: "form", key: "transfer.errGeneric" };
  if (isApiError(error) && error.status === 403) return { where: "form", key: "transfer.errGate" };
  const failure = getFailureKey(error);
  if (failure) return { where: "form", key: failure };
  return { where: "form", key: "transfer.errGeneric" };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useTransfer(
  t: (key: string, vars?: Record<string, string>) => string,
  lang: "id" | "en" = "id",
) {
  const store = useTransferStore();
  const wallet = useCustodialWallet();
  const pinCooldown = useCooldown();
  const stepUp = useCustodialStepUp();
  const setPinSet = usePinSetCorrection();
  const queryClient = useQueryClient();

  const parsedAmount = parseAmount(store.amount);
  const addressError = store.to ? validateTransferAddress(store.to, wallet.address) : null;
  const amountError = store.amount ? validateTransferAmount(store.amount, wallet.balanceUsdx) : null;

  const isFormValid =
    wallet.isActive &&
    store.to !== "" &&
    store.amount !== "" &&
    !addressError &&
    !amountError &&
    parsedAmount > 0;

  const mutation = useMutation({
    mutationFn: async ({ pin, twoFactorCode }: { pin: string; twoFactorCode: string }) => {
      const key = store.ensureIdempotencyKey();
      // Jumlah dinormalkan ke bentuk kontrak ("25." → "25", "007" → "7"): yang
      // lolos validator FE tidak boleh ditolak 422 oleh regex backend.
      const body = {
        to: store.to.trim(),
        amount: normalizeTransferAmount(store.amount),
        pin,
        twoFactorCode,
      };
      // Retry IN_PROGRESS dengan key yang SAMA. Yang pertama bisa saja sudah
      // ter-broadcast — key baru = transfer kedua, persis yang kontrak cegah.
      for (let attempt = 0; ; attempt++) {
        try {
          return await transferCustodial(body, key);
        } catch (error) {
          if (isIdempotencyKeyInProgress(error) && attempt < IN_PROGRESS_MAX_RETRIES) {
            const wait = getRateLimitSeconds(error);
            await sleep(wait ? wait * 1_000 : IN_PROGRESS_RETRY_MS);
            continue;
          }
          throw error;
        }
      }
    },
    onSuccess: (accepted) => {
      store.setResult(accepted);
      // Saldo turun begitu tx masuk blok; segarkan di latar.
      wallet.invalidate();
      // Riwayat yang dibuka < 15 s lalu masih dianggap segar — tanpa ini tombol
      // "Riwayat transfer" di layar hasil menampilkan /history tab Keluar tanpa
      // transfer yang baru dikirim (review app#79, USDX-701 → USDX-713).
      void queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    },
    onError: (error) => {
      // Fakta akun, bukan state mutasi: salinan profil yang dikoreksi, supaya tetap
      // tampil setelah `reset()` dan hilang begitu PIN dibuat.
      if (isPinNotSet(error)) setPinSet(false);
      if (isPinLockout(error)) {
        pinCooldown.start(getRateLimitSeconds(error) || DEFAULT_COOLDOWN_SECONDS);
      }
      stepUp.onError(error);
      // Backend menolak karena statusnya bukan ACTIVE → salinan di profil basi;
      // tarik status sebenarnya supaya pesan dan tombol mengikuti keadaan nyata.
      if (isWalletNotActive(error)) wallet.invalidate();
      if (isIdempotencyKeyReused(error)) {
        // Bug FE menurut kontrak: key tidak dibuat ulang saat body berubah.
        console.error("[transfer] IDEMPOTENCY_KEY_REUSED — key dibuang", error);
        store.clearIdempotencyKey();
      }
      const mapped = mapTransferError(error, t, wallet.status === "none" ? null : wallet.status, lang);
      // Error non-PIN tampil di Ringkasan: tutup dialog PIN supaya pesannya terlihat.
      // `null` (RATE_LIMITED → toast global) membiarkan dialog apa adanya: user
      // cukup menekan kirim lagi setelah throttle lewat, dengan key yang sama.
      if (mapped && mapped.where !== "pin" && mapped.where !== "twoFactor") store.setPinOpen(false);
    },
  });

  const walletStatus = wallet.status === "none" ? null : wallet.status;
  const error = useMemo(
    () => mapTransferError(mutation.error, t, walletStatus, lang),
    [mutation.error, t, walletStatus, lang],
  );

  const setMaxAmount = useCallback(() => {
    if (wallet.balanceUsdx == null || wallet.balanceUsdx <= 0) return;
    store.setAmount(String(wallet.balanceUsdx));
  }, [wallet.balanceUsdx, store]);

  // WALLET_NOT_ACTIVE: statusnya tidak berubah karena ditekan lagi → tombol
  // kirim dimatikan sampai status wallet berubah (refetch).
  const walletBlocked = isWalletNotActive(mutation.error) || (wallet.hasWallet && !wallet.isActive);

  return {
    // wallet
    walletAddress: wallet.address,
    walletStatus,
    isWalletActive: wallet.isActive,
    balanceUsdx: wallet.balanceUsdx,
    balanceState: wallet.balanceState,
    // form
    to: store.to,
    setTo: store.setTo,
    amount: store.amount,
    setAmount: store.setAmount,
    setMaxAmount,
    parsedAmount,
    addressError,
    amountError,
    isFormValid,
    walletBlocked,
    // step + modals
    step: store.step,
    result: store.result,
    reviewOpen: store.reviewOpen,
    setReviewOpen: store.setReviewOpen,
    pinOpen: store.pinOpen,
    openPin: () => {
      mutation.reset();
      store.setPinOpen(true);
    },
    setPinOpen: store.setPinOpen,
    reset: () => {
      mutation.reset();
      store.reset();
    },
    // submit
    submitWithPin: (pin: string, twoFactorCode: string) =>
      mutation.mutateAsync({ pin, twoFactorCode }).catch(() => undefined),
    isSubmitting: mutation.isPending,
    // errors — PIN-related stay in the PIN dialog, the rest go to the Ringkasan
    formErrorKey: error?.where === "form" ? error.key : null,
    formErrorVars: error?.where === "form" ? error.vars : undefined,
    // errLocked → `pinCooldownSeconds`, errNotSet → `pinNotSet`: keduanya punya
    // tampilan sendiri di dialog, bukan kalimat error di bawah kolom.
    pinErrorKey:
      error?.where === "pin" && error.key !== "pin.errLocked" && error.key !== "pin.errNotSet"
        ? error.key
        : null,
    pinNotSet: wallet.pinSet === false,
    pinCooldownSeconds: pinCooldown.remaining,
    // 2FA (USDX-717) — errLocked → `twoFactorCooldownSeconds` (hitung mundur sendiri).
    twoFactorErrorKey:
      error?.where === "twoFactor" && error.key !== "stepUp.errLocked" ? error.key : null,
    twoFactorCooldownSeconds: stepUp.twoFactorCooldownSeconds,
    twoFactorSetupRequired: stepUp.twoFactorSetupRequired,
    outboundLockedUntil: stepUp.lockedUntil,
  };
}
