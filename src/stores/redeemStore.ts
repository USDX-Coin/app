import { create } from "zustand";
import type { RedeemStep, AmountCurrency } from "@/types";

// Redeem form state (USDX-243). Bank fields are entered inline per order
// (redeem.yaml CreateRedeemOrder) — there's no saved bank-account book. The
// Ringkasan is a modal over the form, so the only views are `form` and the
// `tracker` (polling the created order). `chain` is fixed to Polygon in Phase 2
// (week3.md § Chain) and applied at request build, so it isn't kept in state.
interface RedeemState {
  step: RedeemStep;
  amount: string;
  amountCurrency: AmountCurrency; // currency the user typed the amount in
  bankCode: string;
  bankAccountNumber: string;
  bankAccountName: string;
  orderId: string | null; // created order id the status tracker polls
  setStep: (step: RedeemStep) => void;
  setAmount: (amount: string) => void;
  setAmountCurrency: (currency: AmountCurrency) => void;
  setBankCode: (code: string) => void;
  setBankAccountNumber: (value: string) => void;
  setBankAccountName: (value: string) => void;
  setOrderId: (id: string) => void;
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
  reset: () => set(initialState),
}));
