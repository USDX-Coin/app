import { create } from "zustand";
import type { RedeemStep, RedeemOrder } from "@/types";
import { DEFAULT_CHAIN_ID } from "@/lib/chains";

interface RedeemState {
  step: RedeemStep;
  chainId: string;
  amount: string;
  bankAccountId: string;
  result: RedeemOrder | null;
  setStep: (step: RedeemStep) => void;
  setChainId: (chainId: string) => void;
  setAmount: (amount: string) => void;
  setBankAccountId: (id: string) => void;
  setResult: (result: RedeemOrder) => void;
  reset: () => void;
}

const initialState = {
  step: "form" as RedeemStep,
  chainId: DEFAULT_CHAIN_ID,
  amount: "",
  bankAccountId: "",
  result: null as RedeemOrder | null,
};

export const useRedeemStore = create<RedeemState>()((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setChainId: (chainId) => set({ chainId }),
  setAmount: (amount) => set({ amount }),
  setBankAccountId: (id) => set({ bankAccountId: id }),
  setResult: (result) => set({ result }),
  reset: () => set(initialState),
}));
