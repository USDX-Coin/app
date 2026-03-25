import { create } from "zustand";
import type { MintStep } from "@/types";
import { DEFAULT_CHAIN_ID } from "@/lib/chains";

interface MintState {
  step: MintStep;
  chainId: string;
  amount: string;
  destinationAddress: string;
  setStep: (step: MintStep) => void;
  setChainId: (chainId: string) => void;
  setAmount: (amount: string) => void;
  setDestinationAddress: (address: string) => void;
  reset: () => void;
}

const initialState = {
  step: "form" as MintStep,
  chainId: DEFAULT_CHAIN_ID,
  amount: "",
  destinationAddress: "",
};

export const useMintStore = create<MintState>()((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setChainId: (chainId) => set({ chainId }),
  setAmount: (amount) => set({ amount }),
  setDestinationAddress: (address) => set({ destinationAddress: address }),
  reset: () => set(initialState),
}));
