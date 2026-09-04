"use client";

// Mint form logic (USDX-201). Combines the mint store + live rate
// (GET /v2/rate) + validation + the create-order mutation (POST /v2/mint).
// On success it hands off (cross-origin redirect) to the own-hosted checkout repo
// at `mint.usdx.co.id/checkout/{id}#code=<code>` — a one-time authorization code in
// the URL hash (USDX-378 · WSTG-CLNT-12; supersedes the `#token=` bearer-JWT handoff
// USDX-240/USDX-357, which itself superseded the cross-subdomain cookie USDX-225/226).
// The Ringkasan (review) is a modal, so there's no in-page step machine anymore —
// see mintStore.

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMintStore } from "@/stores/mintStore";
import { useConsumerRate } from "@/hooks/useConsumerRate";
import { createMintOrder } from "@/lib/api/mint-api";
import { mintCheckoutCode } from "@/lib/api/auth-api";
import { env } from "@/lib/env";
import { validateAmount, validateAddress } from "@/lib/validations";
import { parseAmount } from "@/lib/utils";
import { getChainById } from "@/lib/chains";
import { isApiError, isValidationError, isRateLimited } from "@/lib/api/errors";

// Maps a create-order failure to an i18n key the review modal renders inline
// (week2.md § Endpoints Mint error codes).
function mintErrorKey(error: unknown): string | null {
  if (!error) return null;
  // 429 RATE_LIMITED is surfaced globally as a toast (Providers query/mutation
  // cache, USDX-252) — suppress the inline modal error (would read as a generic
  // failure); the user can retry once the throttle clears.
  if (isRateLimited(error)) return null;
  if (isApiError(error)) {
    if (error.code === "RECIPIENT_BLACKLISTED") return "mint.errBlacklisted";
    if (isValidationError(error)) return "mint.errValidation";
    if (error.code === "MINT_DISABLED") return "mint.errDisabled";
    if (error.status === 403) return "mint.errGate"; // EMAIL/KYC/SUSPENDED gating
  }
  return "mint.errGeneric";
}

export function useMint() {
  const store = useMintStore();
  const queryClient = useQueryClient();
  const rateQuery = useConsumerRate();

  const effectiveBuyRate = rateQuery.data ? Number(rateQuery.data.effectiveBuyRate) : null;
  const enteredAmount = parseAmount(store.amount);

  // Derive the USDX amount + IDR subtotal from the entered currency + live rate.
  // "Anda akan bayar" = subtotal (before fee; fee is shown at checkout).
  const { amountUsdx, subtotalIdr } = useMemo(() => {
    if (!effectiveBuyRate || enteredAmount <= 0) return { amountUsdx: 0, subtotalIdr: 0 };
    return store.amountCurrency === "USD"
      ? { amountUsdx: enteredAmount, subtotalIdr: enteredAmount * effectiveBuyRate }
      : { amountUsdx: enteredAmount / effectiveBuyRate, subtotalIdr: enteredAmount };
  }, [enteredAmount, store.amountCurrency, effectiveBuyRate]);

  // Validate the USDX amount against the mint min/max. A USD input is itself the
  // USDX amount; an IDR input needs the rate to convert first (skip until loaded).
  const amountError = !store.amount
    ? null
    : store.amountCurrency === "USD"
      ? validateAmount(store.amount, "mint")
      : effectiveBuyRate
        ? validateAmount(String(amountUsdx), "mint")
        : null;

  const addressError = store.destinationAddress
    ? validateAddress(store.destinationAddress)
    : null;

  const selectedChain = useMemo(() => getChainById(store.chainId), [store.chainId]);

  const isFormValid =
    store.amount !== "" &&
    store.destinationAddress !== "" &&
    !amountError &&
    !addressError &&
    effectiveBuyRate != null &&
    amountUsdx > 0;

  const createMutation = useMutation({
    mutationFn: () =>
      createMintOrder({
        userAddress: store.destinationAddress.trim(),
        // Backend interprets `amount` by `amountCurrency`: USD = USDX amount,
        // IDR = subtotal (mint value). Pass the raw input either way.
        amount: store.amount.trim(),
        amountCurrency: store.amountCurrency,
        chain: store.chainId,
      }),
    onSuccess: async (order) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Latch the handoff BEFORE leaving. Two jobs:
      //  1. Keeps "Lanjut Pembayaran" disabled for the whole navigation window.
      //     `isPending` can't: it flips back to idle as soon as this callback
      //     returns, while the cross-origin load is still in flight — a second
      //     click in that gap creates a second order with a second VA.
      //  2. Marks this page as "already handed off", so if the browser later
      //     restores it from the back-forward cache (Back from checkout),
      //     `useMintHandoffReset` knows to wipe the form + modal instead of
      //     handing the user a live confirm button for an order they paid.
      store.beginHandoff();
      // Cross-origin handoff ke checkout own-hosted (repo `checkout`). location.href
      // (push, bukan replace) → tombol "Kembali" di checkout balik ke /mint. Auth =
      // one-time code lewat URL hash `#code=` (USDX-378, WSTG-CLNT-12): backend
      // menerbitkan authorization code sekali-pakai (TTL 60 detik) via
      // POST /api/v2/auth/checkout-token; checkout menukarnya (exchange) jadi sesi
      // sendiri lalu strip URL. Token sesi app TIDAK dibaca dari storage untuk
      // handoff (CLNT-12), dan URL tidak lagi membawa bearer 30-hari — replay dari
      // history/screenshot mati karena code kedaluwarsa 60 detik & sekali-pakai.
      let hash = "";
      try {
        const handoffCode = await mintCheckoutCode();
        hash = `#code=${encodeURIComponent(handoffCode)}`;
      } catch {
        // Gagal terbitkan code → tetap redirect; checkout minta login sendiri
        // (graceful degradation, sama seperti perilaku token-absent sebelumnya).
      }
      window.location.href = `${env.checkoutUrl}/checkout/${order.id}${hash}`;
    },
  });

  function toggleCurrency() {
    store.setAmountCurrency(store.amountCurrency === "USD" ? "IDR" : "USD");
  }

  return {
    // form fields
    amount: store.amount,
    setAmount: store.setAmount,
    amountCurrency: store.amountCurrency,
    setAmountCurrency: store.setAmountCurrency,
    toggleCurrency,
    destinationAddress: store.destinationAddress,
    setDestinationAddress: store.setDestinationAddress,
    chainId: store.chainId,
    selectedChain,
    reset: store.reset,
    // Ringkasan modal visibility — store-owned so `reset()` closes it too
    reviewOpen: store.reviewOpen,
    setReviewOpen: store.setReviewOpen,
    // rate
    rate: rateQuery.data ?? null,
    effectiveBuyRate,
    isRateLoading: rateQuery.isLoading,
    isRateError: rateQuery.isError,
    // A failed rate load needs an action, not just a sentence (finding B8):
    // the form renders a "Coba lagi" button that calls this.
    isRateFetching: rateQuery.isFetching,
    refetchRate: rateQuery.refetch,
    // derived amounts
    enteredAmount,
    amountUsdx,
    subtotalIdr,
    // validation
    amountError,
    addressError,
    isFormValid,
    // submit (create order → redirect to checkout)
    submitMint: () => createMutation.mutateAsync(),
    isCreating: createMutation.isPending,
    // The order exists and the browser is on its way to checkout.
    isHandingOff: store.handoffPending,
    // What the confirm button must actually be gated on: creating OR handing off.
    isSubmitting: createMutation.isPending || store.handoffPending,
    createErrorKey: mintErrorKey(createMutation.error),
    resetCreateError: createMutation.reset,
  };
}
