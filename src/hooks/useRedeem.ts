"use client";

// Redeem form logic (USDX-243, hardened USDX-259). Combines the redeem store + live
// sell rate (GET /v2/rate `effectiveSellRate`) + fee breakdown + validation + the
// contextual wallet connect & precondition gate (network/balance/gas) + the
// create-order mutation (POST /v2/redeem, sending the connected `userAddress`),
// then hands the created order to the status tracker. The burn itself is run by the
// tracker, after the customer has explicitly agreed to the payout destination the
// order came back with (USDX-661) — the on-chain burn is real via wagmi when
// env.useMock is off (USDX-263); the mock layer simulates it offline.

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRedeemStore } from "@/stores/redeemStore";
import { usePinSetCorrection } from "@/hooks/usePinSetCorrection";
import { useConsumerRate } from "@/hooks/useConsumerRate";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { walletStatusKey } from "@/hooks/useTransfer";
import { useRedeemPreconditions } from "@/lib/redeem/wallet";
import { createRedeemOrder } from "@/lib/api/redeem-api";
import { computeRedeemBreakdown } from "@/lib/redeem/fees";
import {
  validateAmount,
  validateBankAccountNumber,
  validateBankAccountName,
} from "@/lib/validations";
import { parseAmount, formatIDR } from "@/lib/utils";
import { getBankName } from "@/lib/banks";
import {
  REDEEM_CHAIN_ID,
  REDEEM_FEE_PCT,
  DISBURSEMENT_FEE_FLAT_IDR,
  MAX_REDEEM_AMOUNT,
} from "@/lib/constants";
import {
  isApiError,
  isValidationError,
  isRateLimited,
  isInsufficientBalance,
  isWalletBlacklisted,
  isInvalidBankAccount,
  isRedeemDisabled,
  isInvalidPin,
  isPinNotSet,
  isTooManyAttempts,
  isWalletNotActive,
  getRateLimitSeconds,
} from "@/lib/api/errors";

// Maps a create-order failure to an i18n key the review modal renders inline
// (week3.md § Endpoints Redeem error codes). PIN failures on the custodial path
// (401 INVALID_PIN / PIN_NOT_SET, 429 TOO_MANY_ATTEMPTS — redeem.yaml, USDX-565)
// are NOT mapped here: they belong in the PIN dialog (`pinErrorKey` below), so
// the user retypes where the mistake was made.
export function redeemErrorKey(error: unknown): string | null {
  if (!error) return null;
  // 429 RATE_LIMITED is surfaced globally as a toast (Providers query/mutation
  // cache, USDX-252) — suppress the inline modal error so it isn't a misleading
  // generic message, and let the user retry after the throttle clears.
  if (isRateLimited(error)) return null;
  if (isInvalidPin(error) || isPinNotSet(error) || isTooManyAttempts(error)) return null;
  if (isApiError(error)) {
    // Custodial wallet PROVISIONING/SUSPENDED — rejected before any order exists.
    // The status does not change by pressing again (wallet.yaml § 409).
    if (isWalletNotActive(error)) return "redeem.errWalletNotActive";
    // Wallet pre-check failures (USDX-259) — the precondition gate normally blocks
    // these before create, but surface the backend backstop inline too.
    if (isInsufficientBalance(error)) return "redeem.errInsufficientBalance";
    if (isWalletBlacklisted(error)) return "redeem.errWalletBlacklisted";
    if (isInvalidBankAccount(error)) return "redeem.errBankAccount";
    if (isValidationError(error)) return "redeem.errValidation";
    if (isRedeemDisabled(error)) return "redeem.errDisabled";
    if (error.status === 403) return "redeem.errGate"; // EMAIL/KYC/SUSPENDED gating
  }
  return "redeem.errGeneric";
}

export function useRedeem() {
  const store = useRedeemStore();
  const rateQuery = useConsumerRate();
  // The redeem minimum is backend-owned (USDX-682): a rupiah figure from
  // `fee_configs.min_redeem_idr`, served by GET /api/v2/config, movable from the
  // back office without a release. The fee rates on this screen are still the
  // app's own constants, so the config is consulted for the bound and nothing
  // else — a missing response does not blank the form.
  const config = useAppConfig();
  // Sumber burn (USDX-567, custodial-wallet.md §5.3): wallet custodial user
  // (sistem yang menandatangani setelah PIN) atau wallet eksternal ter-connect
  // (self-sign, jalur existing). Pilihan hanya ada untuk pemilik wallet ACTIVE;
  // selain itu `source` dipaksa `external` dan hook ini berperilaku persis
  // seperti sebelumnya.
  const custodial = useCustodialWallet();
  const custodialAvailable = custodial.isActive && !!custodial.address;
  const source = custodialAvailable ? store.source : "external";
  const isCustodialSource = source === "custodial";
  const pinCooldown = useCooldown();
  const setPinSet = usePinSetCorrection();

  const effectiveSellRate = rateQuery.data ? Number(rateQuery.data.effectiveSellRate) : null;
  const enteredAmount = parseAmount(store.amount);

  // Live fee breakdown for the form preview ("Anda akan terima" = net payout).
  // Mirrors the backend fee_configs; POST /v2/redeem stays authoritative.
  const breakdown = useMemo(
    () =>
      computeRedeemBreakdown({
        amount: enteredAmount,
        amountCurrency: store.amountCurrency,
        effectiveSellRate: effectiveSellRate ?? 0,
        redeemFeePct: REDEEM_FEE_PCT,
        disbursementFeeFlatIdr: DISBURSEMENT_FEE_FLAT_IDR,
      }),
    [enteredAmount, store.amountCurrency, effectiveSellRate],
  );

  // Wallet precondition gate against the burn amount (network/balance/gas) —
  // external wallet only. Always called (rules of hooks); ignored on the
  // custodial path, which has no network to switch and no gas to hold.
  const preconditions = useRedeemPreconditions(breakdown.amountUsdx);

  // What burns and what it holds, per source. The custodial balance comes from
  // GET /api/v2/wallet (null = unknown, never 0); the external one from the
  // on-chain read. Shortfall is only asserted against a KNOWN balance.
  const burnAddress = isCustodialSource ? custodial.address : preconditions.address;
  const balanceUsdx = isCustodialSource ? custodial.balanceUsdx : preconditions.balanceUsdx;
  const insufficientBalance = isCustodialSource
    ? breakdown.amountUsdx > 0 && balanceUsdx != null && balanceUsdx < breakdown.amountUsdx
    : preconditions.insufficientBalance;
  const canBurn = isCustodialSource ? !insufficientBalance : preconditions.canBurn;

  // Shape + the USDX ceiling only (USDX-682): the minimum left this validator
  // when it stopped being a USDX number. A USD input is itself the USDX amount;
  // an IDR input needs the rate to convert first (skip until loaded).
  const amountError = !store.amount
    ? null
    : store.amountCurrency === "USD"
      ? validateAmount(store.amount, "redeem")
      : effectiveSellRate
        ? validateAmount(String(breakdown.amountUsdx), "redeem")
        : null;

  const accountNumberError = store.bankAccountNumber
    ? validateBankAccountNumber(store.bankAccountNumber)
    : null;
  const accountNameError = store.bankAccountName
    ? validateBankAccountName(store.bankAccountName)
    : null;

  // THE redeem minimum — one number, in rupiah, judged on what the customer
  // actually receives (`minRedeemIdr` vs `net_payout_idr`, app-config.yaml
  // § AppConfig.minRedeemIdr). Before USDX-682 this screen carried two bounds that
  // both called themselves the minimum: this net-payout floor, and a 10-USDX
  // amount check worth Rp 162.500 at a 16.250 rate. The USDX one is gone.
  //
  // `minRedeemIdr == null` (the backend field ships after this app does, or the
  // config request failed) asserts NOTHING. Not 10 USDX, not Rp 10.000, not the
  // last known value: the app has no minimum to state, `POST /api/v2/redeem` still
  // enforces the real one and its 422 renders inline in the Ringkasan. Falling
  // back to a number instead is how a client ends up rejecting a redeem nobody
  // decided to reject — and closing the screen instead would take redeem down for
  // every user for the whole rollout window, which is a far worse failure than a
  // bound checked one round-trip later.
  const minRedeemIdr = config.minRedeemIdr;
  const belowMinPayout =
    enteredAmount > 0 &&
    effectiveSellRate != null &&
    minRedeemIdr != null &&
    breakdown.netPayoutIdr < minRedeemIdr;

  // The rupiah figure inside "Jumlah diterima minimal Rp 20.000" — it belongs to
  // the config, so it travels with the message instead of being copied into a
  // dictionary (id-ID formatting via `formatIDR`, same as the mint minimum).
  const minPayoutVars =
    belowMinPayout && minRedeemIdr != null ? { amount: formatIDR(minRedeemIdr) } : undefined;

  // Bank destination is two-path (USDX-267): a saved account needs only the picked
  // reference; manual entry needs the full, valid trio.
  const hasBankDestination = store.savedAccount
    ? true
    : store.bankCode !== "" &&
      store.bankAccountNumber !== "" &&
      store.bankAccountName !== "" &&
      !accountNumberError &&
      !accountNameError;

  const isFormValid =
    store.amount !== "" &&
    hasBankDestination &&
    !amountError &&
    effectiveSellRate != null &&
    breakdown.amountUsdx > 0 &&
    !belowMinPayout;

  // Unified destination for the read-only summary + Ringkasan. Both paths render the
  // full number + resolved bank name (un-mask 2026-06-25, USDX-270): saved path from
  // the picked entry, manual path from the typed fields (bank name resolved locally).
  const destination = store.savedAccount
    ? {
        bankCode: store.savedAccount.bankCode,
        bankName: store.savedAccount.bankName,
        accountNumber: store.savedAccount.accountNumber,
        accountName: store.savedAccount.accountName,
      }
    : {
        bankCode: store.bankCode,
        bankName: getBankName(store.bankCode),
        accountNumber: store.bankAccountNumber,
        accountName: store.bankAccountName,
      };

  const createMutation = useMutation({
    // `pin` only travels on the custodial path (redeem.yaml § CreateRedeemOrder.pin):
    // the backend ignores it on SELF_SIGN, and the FE does not send it there.
    mutationFn: (pin?: string) =>
      createRedeemOrder({
        amount: store.amount.trim(),
        amountCurrency: store.amountCurrency,
        chain: REDEEM_CHAIN_ID,
        // Custodial: the user's custodial address (backend derives burnMode from
        // it); external: the connected burn wallet (USDX-259).
        userAddress: burnAddress ?? "",
        ...(isCustodialSource && pin ? { pin } : {}),
        // Two-path bank destination (USDX-267): saved → only `bankAccountId` (the
        // backend resolves the number/name from the entry); manual → the trio.
        // Omitted fields drop from the JSON body.
        ...(store.savedAccount
          ? { bankAccountId: store.savedAccount.id }
          : {
              bankCode: store.bankCode,
              bankAccountNumber: store.bankAccountNumber.trim(),
              bankAccountName: store.bankAccountName.trim(),
            }),
      }),
    onError: (error) => {
      // Fakta akun, bukan state mutasi (USDX-651): salinan profil `user.pinSet`
      // yang dikoreksi; PinSetupDialog dari notice mengembalikannya ke true.
      if (isPinNotSet(error)) setPinSet(false);
      if (isTooManyAttempts(error)) {
        pinCooldown.start(getRateLimitSeconds(error) || DEFAULT_COOLDOWN_SECONDS);
      }
      // Backend says the wallet is not ACTIVE while the profile copy said it was →
      // the copy is stale; refetch so the message + the disabled button follow reality.
      if (isWalletNotActive(error)) custodial.invalidate();
      // Non-PIN failures show in the Ringkasan: close the PIN dialog so they are seen.
      if (!isInvalidPin(error) && !isPinNotSet(error) && !isTooManyAttempts(error)) {
        store.setPinOpen(false);
      }
    },
  });

  // 409 WALLET_NOT_ACTIVE: "tampilkan status wallet, jangan tawarkan retry"
  // (wallet.yaml § 409) — the status does not change by pressing again.
  const walletBlocked = isWalletNotActive(createMutation.error);

  function toggleCurrency() {
    store.setAmountCurrency(store.amountCurrency === "USD" ? "IDR" : "USD");
  }

  // "Max" → redeem the full connected-wallet USDX balance (capped at the redeem
  // max). The amount field follows the active denomination: USD = USDX directly,
  // IDR = gross sale value (balance × sell rate, floored to whole rupiah).
  function setMaxAmount() {
    const balance = balanceUsdx;
    if (balance == null || balance <= 0) return;
    const maxUsdx = Math.min(balance, MAX_REDEEM_AMOUNT);
    if (store.amountCurrency === "USD") {
      store.setAmount(String(maxUsdx));
    } else if (effectiveSellRate) {
      store.setAmount(String(Math.floor(maxUsdx * effectiveSellRate)));
    }
  }

  // Create the order → navigate to the tracker. The burn is NOT fired from here
  // (USDX-661, bni-integration.md § 17.12): the tracker first states the payout
  // destination as the ORDER answered it — bank · nomor rekening · nama pemilik, and
  // whether that name is the bank's answer at all (USDX-672, `bankAccountNameVerified`)
  // — and waits for an explicit agreement. Until then the burn button
  // is disabled, and pressing it is what runs `runBurn` (the same guarded path the
  // resume-from-/history flow already used). Mengonfirmasi ketikan sendiri di
  // Ringkasan bukan verifikasi apa pun: nama dari inquiry baru ada setelah order
  // terbit, jadi jedanya memang harus di sini.
  //
  // Custodial (`burnMode: CUSTODIAL` — decided by the BACKEND in the create
  // response, not by the FE): nothing to sign and nothing to confirm. The PIN sent
  // with the create was the approval; the system dispatches the burn and the tracker
  // shows "memproses burn" until the scanner confirms.
  async function submitRedeem(pin?: string) {
    const order = await createMutation.mutateAsync(pin);
    store.setOrderId(order.id);
    store.setStep("tracker");
    if (order.burnMode === "CUSTODIAL") {
      custodial.invalidate(); // saldo turun begitu burn masuk blok
    }
    return order;
  }

  return {
    // form fields
    amount: store.amount,
    setAmount: store.setAmount,
    setMaxAmount,
    amountCurrency: store.amountCurrency,
    toggleCurrency,
    bankCode: store.bankCode,
    setBankCode: store.setBankCode,
    bankAccountNumber: store.bankAccountNumber,
    setBankAccountNumber: store.setBankAccountNumber,
    bankAccountName: store.bankAccountName,
    setBankAccountName: store.setBankAccountName,
    // saved-account (two-path) destination — USDX-267
    savedAccount: store.savedAccount,
    selectSavedAccount: store.selectSavedAccount,
    clearSavedAccount: store.clearSavedAccount,
    destination, // unified display: { bankCode, bankName, accountNumber, accountName }
    reset: store.reset,
    // rate
    effectiveSellRate,
    isRateLoading: rateQuery.isLoading,
    isRateError: rateQuery.isError,
    // derived breakdown: amountUsdx, grossIdr, redeemFeeIdr, disbursementFeeIdr,
    // totalFeeIdr, netPayoutIdr
    ...breakdown,
    // validation
    amountError,
    accountNumberError,
    accountNameError,
    belowMinPayout,
    // `{amount}` for `redeem.minPayout` — the configured minimum, formatted.
    minPayoutVars,
    // runtime config (GET /api/v2/config): null while the backend has no
    // `minRedeemIdr` yet, which means "no client-side minimum", not zero.
    minRedeemIdr,
    isFormValid,
    // burn source (USDX-567): custodial wallet (PIN, system signs) or external
    // wallet (connect + self-sign). The switch only exists for custodial owners.
    source,
    setSource: store.setSource,
    custodialAvailable,
    isCustodialSource,
    custodialAddress: custodialAvailable ? custodial.address : null,
    custodialBalanceState: custodial.balanceState,
    // wallet + preconditions (contextual connect — redeem-only, no global button).
    // On the custodial path there is no wallet to connect, no network to switch
    // and no gas to warn about: the gate collapses to the balance check.
    isWalletConnected: isCustodialSource ? true : preconditions.isConnected,
    walletAddress: burnAddress,
    connectWallet: preconditions.connect,
    chainOk: isCustodialSource ? true : preconditions.chainOk,
    switchNetwork: preconditions.switchNetwork,
    isSwitchingNetwork: isCustodialSource ? false : preconditions.isSwitchingNetwork,
    balanceUsdx,
    insufficientBalance,
    lowGasWarning: isCustodialSource ? false : preconditions.lowGasWarning,
    canBurn,
    // PIN dialog (custodial path) — store-owned so a create success closes it.
    pinOpen: store.pinOpen,
    setPinOpen: store.setPinOpen,
    openPin: () => {
      createMutation.reset();
      store.setPinOpen(true);
    },
    // PIN_NOT_SET is shown through `pinNotSet` (notice + Create PIN), not as an
    // error sentence under the field.
    pinErrorKey: isInvalidPin(createMutation.error) ? "pin.errInvalid" : null,
    pinNotSet: custodial.pinSet === false,
    pinCooldownSeconds: pinCooldown.remaining,
    // submit (create order → tracker → guarded burn / system-dispatched burn)
    submitRedeem,
    isCreating: createMutation.isPending,
    createErrorKey: redeemErrorKey(createMutation.error),
    // `{status}` for redeem.errWalletNotActive — an i18n key the component translates.
    createErrorStatusKey: walletBlocked ? walletStatusKey(custodial.status) : null,
    walletBlocked,
    resetCreateError: createMutation.reset,
  };
}
