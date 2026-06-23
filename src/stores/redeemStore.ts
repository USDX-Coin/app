import { create } from "zustand";
import type { RedeemStep, AmountCurrency, RedeemBurnState } from "@/types";

// Redeem form state (USDX-243, hardened USDX-259). Bank fields are entered inline
// per order (redeem.yaml CreateRedeemOrder) — there's no saved bank-account book.
// The Ringkasan is a modal over the form, so the only views are `form` and the
// `tracker` (polling the created order). `chain` is fixed to Polygon in Phase 2
// (week3.md § Chain) and applied at request build, so it isn't kept in state.
//
// `burnState` guards the on-chain burn (week3.md § Guard double-burn): once a burn
// is broadcast the button is disabled until the scanner confirms; a rejected/failed
// tx flips to `error` so the user can retry (the order stays AWAITING_BURN).
interface RedeemState {
  step: RedeemStep;
  amount: string;
  amountCurrency: AmountCurrency; // currency the user typed the amount in
  bankCode: string;
  bankAccountNumber: string;
  bankAccountName: string;
  orderId: string | null; // created order id the status tracker polls
  burnState: RedeemBurnState;
  burnErrorKey: string | null; // i18n key for a failed burn (null when none)
  setStep: (step: RedeemStep) => void;
  setAmount: (amount: string) => void;
  setAmountCurrency: (currency: AmountCurrency) => void;
  setBankCode: (code: string) => void;
  setBankAccountNumber: (value: string) => void;
  setBankAccountName: (value: string) => void;
  setOrderId: (id: string) => void;
  setBurnState: (state: RedeemBurnState) => void;
  setBurnError: (key: string | null) => void;
  // Open the tracker for an existing order (resume from /history) — sets the
  // order id, clears any prior burn state, and switches to the tracker view.
  resumeOrder: (id: string) => void;
  reset: () => void;
}

const initialState = {
  step: "form" as RedeemStep,
  amount: "",
  amountCurrency: "USD" as AmountCurrency,
  bankCode: "",
  bankAccountNumber: "",
  bankAccountName: "",
  orderId: null as string | null,
  burnState: "idle" as RedeemBurnState,
  burnErrorKey: null as string | null,
};

export const useRedeemStore = create<RedeemState>()((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setAmount: (amount) => set({ amount }),
  setAmountCurrency: (amountCurrency) => set({ amountCurrency }),
  setBankCode: (bankCode) => set({ bankCode }),
  setBankAccountNumber: (bankAccountNumber) => set({ bankAccountNumber }),
  setBankAccountName: (bankAccountName) => set({ bankAccountName }),
  setOrderId: (orderId) => set({ orderId }),
  setBurnState: (burnState) => set({ burnState }),
  setBurnError: (burnErrorKey) => set({ burnErrorKey }),
  resumeOrder: (orderId) =>
    set({ orderId, step: "tracker", burnState: "idle", burnErrorKey: null }),
  reset: () => set(initialState),
}));
