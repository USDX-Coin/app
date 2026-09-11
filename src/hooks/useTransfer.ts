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
//     oleh semua retry — salah PIN, 503, jaringan putus — dan dibuang hanya saat
//     user mengubah tujuan/jumlah (store yang menjaga itu);
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

import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTransferStore } from "@/stores/transferStore";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { transferCustodial } from "@/lib/api/wallet-api";
import { validateTransferAddress, validateTransferAmount } from "@/lib/validations";
import { parseAmount, formatAmount } from "@/lib/utils";
import {
  isApiError,
  isValidationError,
  isRateLimited,
  isInvalidPin,
  isPinNotSet,
  isTooManyAttempts,
  isWalletNotActive,
  isWalletNotFound,
  isWalletServiceUnavailable,
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
  /** Di mana pesannya tampil: dialog PIN (`pin`) atau Ringkasan (`form`). */
  where: "pin" | "form";
  key: string;
  vars?: Record<string, string>;
}

// Kata status untuk pesan 409 WALLET_NOT_ACTIVE. Salinan profil bisa basi (backend
// menolak padahal profil masih ACTIVE) → "belum aktif", sambil status di-refetch.
export function walletStatusKey(status: CustodialWalletStatus | null): string {
  if (status === "SUSPENDED") return "wallet.statusSuspended";
  if (status === "PROVISIONING") return "wallet.statusProvisioning";
  return "wallet.statusInactive";
}

// Pemetaan error create → kunci i18n + lokasi tampil. Diekspor untuk diuji tanpa
// React. `null` = tidak perlu pesan inline (RATE_LIMITED → toast global).
export function mapTransferError(
  error: unknown,
  t: (key: string, vars?: Record<string, string>) => string,
  walletStatus: CustodialWalletStatus | null,
): TransferError | null {
  if (!error) return null;
  if (isRateLimited(error)) return null;
  if (isInvalidPin(error)) return { where: "pin", key: "pin.errInvalid" };
  if (isPinNotSet(error)) return { where: "pin", key: "pin.errNotSet" };
  if (isTooManyAttempts(error)) return { where: "pin", key: "pin.errLocked" };
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
          resetAt: d.resetAt ? new Date(d.resetAt).toLocaleTimeString() : "—",
        },
      };
    }
    return { where: "form", key: "transfer.errLimitPerTx", vars: { limit: "—" } };
  }
  if (isRecipientBlacklisted(error)) return { where: "form", key: "transfer.errBlacklisted" };
  if (isInsufficientBalance(error)) return { where: "form", key: "transfer.errInsufficient" };
  if (isValidationError(error)) return { where: "form", key: "transfer.errValidation" };
  if (isWalletNotFound(error)) return { where: "form", key: "transfer.errNoWallet" };
  if (isWalletServiceUnavailable(error)) return { where: "form", key: "transfer.errServiceUnavailable" };
  if (isIdempotencyKeyInProgress(error)) return { where: "form", key: "transfer.errInProgress" };
  if (isIdempotencyKeyReused(error)) return { where: "form", key: "transfer.errGeneric" };
  if (isApiError(error) && error.status === 403) return { where: "form", key: "transfer.errGate" };
  const failure = getFailureKey(error);
  if (failure) return { where: "form", key: failure };
  return { where: "form", key: "transfer.errGeneric" };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useTransfer(t: (key: string, vars?: Record<string, string>) => string) {
  const store = useTransferStore();
  const wallet = useCustodialWallet();
  const pinCooldown = useCooldown();
  // Dipisah dari state mutasi: `mutation.error` ikut hilang saat `reset()`, tapi
  // "PIN belum diset" adalah fakta akun yang harus tetap tampil di dialog.
  const [pinNotSet, setPinNotSet] = useState(false);

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
    mutationFn: async (pin: string) => {
      const key = store.ensureIdempotencyKey();
      const body = { to: store.to.trim(), amount: store.amount.trim(), pin };
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
      setPinNotSet(false);
      store.setResult(accepted);
      // Saldo turun begitu tx masuk blok; segarkan di latar.
      wallet.invalidate();
    },
    onError: (error) => {
      if (isPinNotSet(error)) setPinNotSet(true);
      if (isTooManyAttempts(error)) {
        pinCooldown.start(getRateLimitSeconds(error) || DEFAULT_COOLDOWN_SECONDS);
      }
      // Backend menolak karena statusnya bukan ACTIVE → salinan di profil basi;
      // tarik status sebenarnya supaya pesan dan tombol mengikuti keadaan nyata.
      if (isWalletNotActive(error)) wallet.invalidate();
      if (isIdempotencyKeyReused(error)) {
        // Bug FE menurut kontrak: key tidak dibuat ulang saat body berubah.
        console.error("[transfer] IDEMPOTENCY_KEY_REUSED — key dibuang", error);
        store.clearIdempotencyKey();
      }
      const mapped = mapTransferError(error, t, wallet.status);
      // Error non-PIN tampil di Ringkasan: tutup dialog PIN supaya pesannya terlihat.
      if (mapped?.where !== "pin") store.setPinOpen(false);
    },
  });

  const error = useMemo(
    () => mapTransferError(mutation.error, t, wallet.status),
    [mutation.error, t, wallet.status],
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
    hasWallet: wallet.hasWallet,
    walletAddress: wallet.address,
    walletStatus: wallet.status,
    isWalletActive: wallet.isActive,
    isWalletLoading: wallet.isLoading,
    balanceUsdx: wallet.balanceUsdx,
    balanceState: wallet.balanceState,
    refetchWallet: wallet.refetch,
    pinSet: wallet.pinSet,
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
      setPinNotSet(false);
      store.reset();
    },
    // submit
    submitWithPin: (pin: string) => mutation.mutateAsync(pin).catch(() => undefined),
    isSubmitting: mutation.isPending,
    idempotencyKey: store.idempotencyKey,
    // errors
    error, // { where, key, vars } | null
    formErrorKey: error?.where === "form" ? error.key : null,
    formErrorVars: error?.where === "form" ? error.vars : undefined,
    pinErrorKey: error?.where === "pin" && error.key !== "pin.errLocked" ? error.key : null,
    pinNotSet: pinNotSet || wallet.pinSet === false,
    pinCooldownSeconds: pinCooldown.remaining,
    resetError: mutation.reset,
  };
}
