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
import { cheapestBuyRate, offeredBuyRates, subtotalForMinimum } from "@/lib/mint/pricing";
import { getChainById } from "@/lib/chains";
import {
  isApiError,
  isValidationError,
  isRateLimited,
  isMintUnderMaintenance,
} from "@/lib/api/errors";

// 503 MINT_DISABLED — no payment method is offered (§4.3.2). Its own code,
// distinct from MINT_UNDER_MAINTENANCE (app-config.yaml § mintAvailable).
function isMintDisabledError(error: unknown): boolean {
  return isApiError(error) && error.status === 503 && error.code === "MINT_DISABLED";
}

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
    if (isMintDisabledError(error)) return "mint.errDisabled";
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

  // D25 (`bni-integration.md` §4.3.3/§4.3.4, rev-15): two buy rates, one per
  // method — Transfer BNI and Virtual Account. Only the methods the backend is
  // OFFERING count (`paymentMethods[]` from GET /api/v2/config, set by admin in
  // the back office), and the form converts with the CHEAPEST of them, both ways:
  // "Senilai Rp Y" = USDX × that rate, a rupiah entry ÷ that rate = USDX — the
  // divisor create uses to lock the USDX amount. The total per method, fees
  // included, is shown only in checkout.
  const buyRates = useMemo(
    () => offeredBuyRates(rateQuery.data, config.paymentMethods),
    [rateQuery.data, config.paymentMethods],
  );
  const conversionRate = cheapestBuyRate(buyRates);
  // Transfer BNI offered? (`paymentMethods[]` lists BANK_TRANSFER). Unknown —
  // config not loaded yet, or an old backend without the field — counts as NOT
  // offered. Since USDX-749 (PM decision 14 Oct 2026) Transfer BNI never shows
  // a rupiah figure: BNI converts the customer's rupiah at its own rate in
  // wondr, so "Lihat kurs" and the Ringkasan describe it instead of pricing it.
  const offersBniTransfer =
    config.paymentMethods?.some((m) => m.channel === "BANK_TRANSFER") === true;
  const enteredAmount = parseAmount(store.amount);

  // The USDX amount and its rupiah value at the cheapest buy rate ("Senilai",
  // before fees).
  const { amountUsdx, subtotalIdr } = useMemo(() => {
    if (enteredAmount <= 0) return { amountUsdx: 0, subtotalIdr: 0 };
    // Typed in USDX, the USDX figure needs no rate — it must not collapse to 0
    // while the rate or the method list is missing (e.g. the Ringkasan after a
    // 503 MINT_DISABLED re-read the config to an empty list).
    if (!conversionRate) {
      return { amountUsdx: store.amountCurrency === "USD" ? enteredAmount : 0, subtotalIdr: 0 };
    }
    return store.amountCurrency === "USD"
      ? { amountUsdx: enteredAmount, subtotalIdr: enteredAmount * conversionRate }
      : { amountUsdx: enteredAmount / conversionRate, subtotalIdr: enteredAmount };
  }, [enteredAmount, store.amountCurrency, conversionRate]);

  // The rupiah minimum is judged like create judges it (§4.3.4): the order is
  // rejected only when NO offered method passes, so the highest offered rate
  // decides. Showing "Senilai" at the cheapest rate and judging the minimum at
  // the highest is not a contradiction — they answer different questions.
  const minimumSubtotalIdr = subtotalForMinimum(amountUsdx, buyRates);

  // The minimum is judged on the IDR subtotal whichever side the user typed on
  // (USDX-638). Denominating in USDX used to take a different branch that skipped
  // the conversion entirely, so the same purchase passed or failed depending on
  // which box it was entered in.
  //
  // Both the rate and the config must be loaded first: without the rate there is
  // no subtotal to judge, and without the config there is no minimum. Neither is
  // guessed — `isFormValid` keeps the button disabled instead.
  const amountError =
    !store.amount || conversionRate == null || config.minMintIdr == null
      ? null
      : validateAmount(store.amount, "mint", {
          minIdr: config.minMintIdr,
          subtotalIdr: minimumSubtotalIdr ?? 0,
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
      createMintOrder(
        {
          userAddress: destinationAddress.trim(),
          // Backend interprets `amount` by `amountCurrency`: USD = USDX amount,
          // IDR = subtotal (mint value). Pass the raw input either way.
          amount: store.amount.trim(),
          amountCurrency: store.amountCurrency,
          chain: store.chainId,
        },
        // USDX-749 anti-dobel: same intent → same key, so a retry after a dropped
        // connection gets back the order the first attempt already made.
        useMintStore.getState().ensureRequestKey(),
      ),
    onError: (error) => {
      // The gate closed while the user was filling the form. `useMutation` state
      // is per hook instance — MintForm and MintReview each call useMint() — so a
      // flag derived from this error would only ever close the modal, leaving the
      // form behind it live. Re-read the config instead: it is one shared query,
      // the backend is the authority on the gate, and every surface converges on
      // the same answer.
      // Same for 503 MINT_DISABLED: the last method was switched off in the back
      // office after the config was read — the list comes back empty and the
      // form closes with the same sentence.
      if (isMintUnderMaintenance(error) || isMintDisabledError(error)) config.refetch();
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

  // No payment method is offered (`paymentMethods: []` ⟺ 503 MINT_DISABLED,
  // app-config.yaml): nothing could be paid with, so the form says so up front
  // instead of after the Ringkasan. Only a KNOWN empty list counts — an absent
  // or still-loading one is "not ready", handled by `isConfigReady`.
  const isMintDisabled = config.paymentMethods != null && config.paymentMethods.length === 0;

  const isFormValid =
    store.amount !== "" &&
    destinationAddress !== "" &&
    !amountError &&
    !addressError &&
    conversionRate != null &&
    // No config, no mint: the amount would be unvalidated and the offered
    // methods unknown. Better a disabled button with a reason.
    config.isReady &&
    !isMintUnavailable &&
    !isMintDisabled &&
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
      if (!conversionRate) return;
      store.setAmount(
        next === "USD"
          ? toUsdxInput(enteredAmount / conversionRate)
          : // Rupiah has no subunit anywhere else in this flow; whole rupiah is
            // also what keeps the round trip from accumulating a fraction.
            String(Math.round(enteredAmount * conversionRate)),
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
    // The rate "Senilai" converts with (cheapest offered) and the two method
    // rates behind "Lihat kurs" — each null while its method is not offered.
    conversionRate,
    bniTransferBuyRate: buyRates?.bniTransfer ?? null,
    bniTransferBuyRateUpdatedAt:
      buyRates?.bniTransfer != null ? (rateQuery.data?.bniTransferBuyRateUpdatedAt ?? null) : null,
    gatewayBuyRate: buyRates?.gateway ?? null,
    offersBniTransfer,
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
    // No payment method is offered right now (`paymentMethods: []`).
    isMintDisabled,
    isConfigLoading: config.isLoading,
    isConfigError: config.isError,
    isConfigFetching: config.isFetching,
    refetchConfig: config.refetch,
    // derived amounts
    enteredAmount,
    amountUsdx,
    subtotalIdr,
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
