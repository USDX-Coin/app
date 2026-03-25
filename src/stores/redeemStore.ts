import { create } from "zustand";
import type { RedeemStep } from "@/types";
import { DEFAULT_CHAIN_ID } from "@/lib/chains";

interface RedeemState {
  step: RedeemStep;
  chainId: string;
  amount: string;
  bankAccountId: string;
  setStep: (step: RedeemStep) => void;
  setChainId: (chainId: string) => void;
  setAmount: (amount: string) => void;
  setBankAccountId: (id: string) => void;
  reset: () => void;
}

const initialState = {
  step: "form" as RedeemStep,
  chainId: DEFAULT_CHAIN_ID,
  amount: "",
  bankAccountId: "",
};

export const useRedeemStore = create<RedeemState>()((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setChainId: (chainId) => set({ chainId }),
  setAmount: (amount) => set({ amount }),
  setBankAccountId: (id) => set({ bankAccountId: id }),
  reset: () => set(initialState),
}));
