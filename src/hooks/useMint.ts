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
import { useAppConfig } from "@/hooks/useAppConfig";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { createMintOrder } from "@/lib/api/mint-api";
import { mintCheckoutCode } from "@/lib/api/auth-api";
import { env } from "@/lib/env";
import { validateAmount, validateAddress } from "@/lib/validations";
import { parseAmount, formatIDR } from "@/lib/utils";
import { USDX_DECIMALS } from "@/lib/constants";
import { getChainById } from "@/lib/chains";
import {
  isApiError,
  isValidationError,
  isRateLimited,
  isMintUnderMaintenance,
} from "@/lib/api/errors";

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
    // The gate closed between reading the config and submitting. Same words the
    // page already uses — a raw 503 would tell the user nothing, and the real
    // reason (a tester-only test bundle) is not theirs to decode.
    if (isMintUnderMaintenance(error)) return "mint.maintenanceNotice";
    if (error.code === "MINT_DISABLED") return "mint.errDisabled";
    if (error.status === 403) return "mint.errGate"; // EMAIL/KYC/SUSPENDED gating
  }
  return "mint.errGeneric";
}

/**
 * A converted USDX figure, as the text the amount field will hold.
 *
 * Six decimals because that is USDX's on-chain precision — not a display taste.
 * The number matters: round the USDX side to two decimals instead and a
 * Rp 19.000 round trip comes back as Rp 19.024, so the amount climbs every time
 * the button is pressed. At six, `IDR → USDX → IDR` lands back on the same whole
 * rupiah, and repeated swaps settle on a fixed point instead of drifting.
 *
 * Trailing zeros go, so the ordinary case still reads "1.17" and not "1.170000".
 */
function toUsdxInput(value: number): string {
  return value.toFixed(USDX_DECIMALS).replace(/\.?0+$/, "");
}

export function useMint() {
  const store = useMintStore();
  const queryClient = useQueryClient();
  const rateQuery = useConsumerRate();
  // Minimum + fee rates come from the backend at runtime (USDX-635/638), never
  // from a constant: ops move the minimum from the back office, and the VA fee
  // is the provider's, not ours.
  const config = useAppConfig();
  // Tujuan "wallet custodial saya" (USDX-567, custodial-wallet.md §5.2 —
  // mengikat `mint.yaml#CreateMintOrderV2.userAddress`): TIDAK ada field baru.
  // FE cukup mengisi `userAddress` dengan address custodial dari profil; backend
  // tidak membedakannya dari alamat manual. Karena itu "tujuan custodial" di sini
  // hanyalah alamat mana yang dipakai — dan penanda "ke wallet custodial saya"
  // adalah kecocokan byte-identik alamat itu, bukan flag tersendiri.
  const custodial = useCustodialWallet();
  const custodialAvailable = custodial.isActive && !!custodial.address;
  const destinationSource = custodialAvailable ? store.destinationSource : "manual";
  const destinationAddress =
    destinationSource === "custodial" && custodial.address
      ? custodial.address
      : store.destinationAddress;
  const isCustodialDestination =
    custodialAvailable && destinationAddress !== "" && destinationAddress === custodial.address;

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

  // What the user actually pays, itemised (week2.md § Fee & Spread). The rates
  // are the backend's (`mintFeePct` is a percentage of the subtotal, `pgFeeVaFlat`
  // a flat rupiah amount), so the figures here are the same ones checkout bills.
  // null while the config or the rate is missing — a payment screen shows a real
  // number or none at all.
  //
  // The arithmetic mirrors `mint-order.pricing.ts` step for step, because the
  // whole point of showing a total here is that it equals the invoice:
  //   1. each component is settled to 2 decimals first (`resolveMintAmounts`
  //      stores them as 2-dp strings), then
  //   2. the SUM is floored to whole rupiah (`floorTotalPayIdr`).
  // Flooring a raw float sum instead drifts by a rupiah whenever a component's
  // third decimal would have rounded up — the exact surprise this ticket exists
  // to remove.
  const { mintFeeIdr, vaFeeIdr, totalPayIdr } = useMemo(() => {
    if (config.mintFeePct == null || config.pgFeeVaFlat == null || subtotalIdr <= 0) {
      return { mintFeeIdr: null, vaFeeIdr: null, totalPayIdr: null };
    }
    const settle = (value: number) => Number(value.toFixed(2));
    const subtotal = settle(subtotalIdr);
    const fee = settle(subtotalIdr * (config.mintFeePct / 100));
    const va = settle(config.pgFeeVaFlat);
    return {
      mintFeeIdr: fee,
      vaFeeIdr: va,
      totalPayIdr: Math.floor(subtotal + fee + va),
    };
  }, [subtotalIdr, config.mintFeePct, config.pgFeeVaFlat]);

  // The minimum is judged on the IDR subtotal whichever side the user typed on
  // (USDX-638). Denominating in USDX used to take a different branch that skipped
  // the conversion entirely, so the same purchase passed or failed depending on
  // which box it was entered in.
  //
  // Both the rate and the config must be loaded first: without the rate there is
  // no subtotal to judge, and without the config there is no minimum. Neither is
  // guessed — `isFormValid` keeps the button disabled instead.
  const amountError =
    !store.amount || effectiveBuyRate == null || config.minMintIdr == null
      ? null
      : validateAmount(store.amount, "mint", {
          minIdr: config.minMintIdr,
          subtotalIdr,
          amountUsdx,
        });

  // The rupiah figure inside "Nilai mint minimum Rp 20.000" — it belongs to the
  // config, so it travels with the error instead of being copied into a
  // dictionary (id-ID formatting via `formatIDR`).
  //
  // Scoped to the minimum's own key on purpose: every amount message uses the
  // same `{amount}` placeholder, so an unscoped var would rewrite the CEILING
  // too — "Maximum mint is Rp 20.000 USDX".
  const amountErrorVars =
    amountError === "validation.amount.minMint" && config.minMintIdr != null
      ? { amount: formatIDR(config.minMintIdr) }
      : undefined;

  const addressError = destinationAddress ? validateAddress(destinationAddress) : null;

  const selectedChain = useMemo(() => getChainById(store.chainId), [store.chainId]);

  const createMutation = useMutation({
    mutationFn: () =>
      createMintOrder({
        userAddress: destinationAddress.trim(),
        // Backend interprets `amount` by `amountCurrency`: USD = USDX amount,
        // IDR = subtotal (mint value). Pass the raw input either way.
        amount: store.amount.trim(),
        amountCurrency: store.amountCurrency,
        chain: store.chainId,
      }),
    onError: (error) => {
      // The gate closed while the user was filling the form. `useMutation` state
      // is per hook instance — MintForm and MintReview each call useMint() — so a
      // flag derived from this error would only ever close the modal, leaving the
      // form behind it live. Re-read the config instead: it is one shared query,
      // the backend is the authority on the gate, and every surface converges on
      // the same answer.
      if (isMintUnderMaintenance(error)) config.refetch();
    },
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

  // Minting is gated to a list of testers while the test bundle runs (USDX-636).
  // The config says so up front; a 503 says so if the gate closes mid-session,
  // and both must land the user in the same place — told before they type, not
  // after. Deliberately NOT phrased as the test mode anywhere the user can see:
  // "mode uji" is our internal word, and someone who is not part of the test has
  // no reason to learn it.
  const isMintUnavailable =
    !config.mintAvailable || isMintUnderMaintenance(createMutation.error);

  const isFormValid =
    store.amount !== "" &&
    destinationAddress !== "" &&
    !amountError &&
    !addressError &&
    effectiveBuyRate != null &&
    // No config, no mint: the amount would be unvalidated and the review screen
    // would have to invent a fee. Better a disabled button with a reason.
    config.isReady &&
    !isMintUnavailable &&
    amountUsdx > 0;

  // Swapping changes which side you type in — not how much you are buying. So it
  // converts the figure, keeping the two boxes two views of one purchase.
  //
  // It used to carry the digits across untouched, which read them back in the
  // other unit: Rp 19.000 became 19.000 USDX, an order roughly 16.000× the one
  // on screen (USDX-650).
  function toggleCurrency() {
    const next = store.amountCurrency === "USD" ? "IDR" : "USD";

    // Nothing to convert — an empty box, a "0", a lone ".". Flip the sides and
    // leave the text as typed; writing a converted "0" would put a number in a
    // field nobody filled.
    if (enteredAmount > 0) {
      // No rate, no swap. Relabelling a figure whose meaning would change by four
      // orders of magnitude is precisely the bug, so hold until the rate lands.
      if (!effectiveBuyRate) return;
      store.setAmount(
        next === "USD"
          ? toUsdxInput(enteredAmount / effectiveBuyRate)
          : // Rupiah has no subunit anywhere else in this flow; whole rupiah is
            // also what keeps the round trip from accumulating a fraction.
            String(Math.round(enteredAmount * effectiveBuyRate)),
      );
    }

    store.setAmountCurrency(next);
  }

  return {
    // form fields
    amount: store.amount,
    setAmount: store.setAmount,
    amountCurrency: store.amountCurrency,
    setAmountCurrency: store.setAmountCurrency,
    toggleCurrency,
    // Effective destination: the custodial address when that source is chosen,
    // otherwise the typed/picked one. `manualAddress` is the typed value itself,
    // kept so switching back to "Alamat lain" restores what the user had entered.
    destinationAddress,
    manualAddress: store.destinationAddress,
    setDestinationAddress: store.setDestinationAddress,
    destinationSource,
    setDestinationSource: store.setDestinationSource,
    custodialAvailable,
    custodialAddress: custodialAvailable ? custodial.address : null,
    isCustodialDestination,
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
    // runtime config (GET /api/v2/config)
    minMintIdr: config.minMintIdr,
    isConfigReady: config.isReady,
    // Mint is closed for this user (config gate, or a 503 mid-session).
    isMintUnavailable,
    isConfigLoading: config.isLoading,
    isConfigError: config.isError,
    isConfigFetching: config.isFetching,
    refetchConfig: config.refetch,
    // derived amounts
    enteredAmount,
    amountUsdx,
    subtotalIdr,
    mintFeeIdr,
    vaFeeIdr,
    totalPayIdr,
    // validation
    amountError,
    amountErrorVars,
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
