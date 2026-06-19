import { create } from "zustand";
import type { AmountCurrency } from "@/types";
import { MINT_CHAIN_ID } from "@/lib/constants";

// Mint form state (USDX-201). The review (Ringkasan) is now a modal and the
// post-create flow hands off (cross-origin) to the own-hosted checkout repo
// (mint.usdx.co.id, USDX-225), so the old form→confirmation→status machine is gone.
// `chainId` is fixed to Polygon in Phase 2 (week2.md § Chain) — kept in state so
// the create request carries it, but there's no chain picker in the UI.
interface MintState {
  chainId: string;
  amount: string;
  amountCurrency: AmountCurrency; // currency the user typed the amount in
  destinationAddress: string;
  setAmount: (amount: string) => void;
  setAmountCurrency: (currency: AmountCurrency) => void;
  setDestinationAddress: (address: string) => void;
  reset: () => void;
}

const initialState = {
  chainId: MINT_CHAIN_ID,
  amount: "",
  amountCurrency: "USD" as AmountCurrency,
  destinationAddress: "",
};

export const useMintStore = create<MintState>()((set) => ({
  ...initialState,
  setAmount: (amount) => set({ amount }),
  setAmountCurrency: (amountCurrency) => set({ amountCurrency }),
  setDestinationAddress: (address) => set({ destinationAddress: address }),
  reset: () => set(initialState),
}));
