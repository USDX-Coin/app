import { create } from "zustand";
import type { AmountCurrency } from "@/types";
import { MINT_CHAIN_ID } from "@/lib/constants";

// Mint form state (USDX-201). The review (Ringkasan) is now a modal and the
// post-create flow hands off (cross-origin) to the own-hosted checkout repo
// (mint.usdx.co.id, USDX-225), so the old form→confirmation→status machine is gone.
// `chainId` is fixed to Polygon in Phase 2 (week2.md § Chain) — kept in state so
// the create request carries it, but there's no chain picker in the UI.
//
// `reviewOpen` and `handoffPending` live here — not as component state — because
// the whole screen has to be wipeable in one shot after the checkout handoff
// (handoff-return fix, 14 Agu 2026): the browser restores /mint from the
// was left (modal open, amount + address filled, React state idle), so a `reset()`
// that misses the modal flag would leave a live "Lanjut Pembayaran" over an order
// the user already paid → a second order with a second VA.
//   reviewOpen     — Ringkasan modal visibility (owned here so reset() closes it)
//   handoffPending — an order exists and we are leaving for checkout. Sticky on
//                    purpose: it keeps the confirm button disabled for the entire
//                    cross-origin navigation window (the create mutation itself
//                    settles back to idle the moment onSuccess returns), and it is
//                    the marker `useMintHandoffReset` reads on a bfcache restore
//                    to tell a post-handoff leftover from an untouched form.
interface MintState {
  chainId: string;
  amount: string;
  amountCurrency: AmountCurrency; // currency the user typed the amount in
  destinationAddress: string;
  reviewOpen: boolean;
  handoffPending: boolean;
  setAmount: (amount: string) => void;
  setAmountCurrency: (currency: AmountCurrency) => void;
  setDestinationAddress: (address: string) => void;
  setReviewOpen: (open: boolean) => void;
  beginHandoff: () => void;
  reset: () => void;
}

const initialState = {
  chainId: MINT_CHAIN_ID,
  amount: "",
  amountCurrency: "USD" as AmountCurrency,
  destinationAddress: "",
  reviewOpen: false,
  handoffPending: false,
};

export const useMintStore = create<MintState>()((set) => ({
  ...initialState,
  setAmount: (amount) => set({ amount }),
  setAmountCurrency: (amountCurrency) => set({ amountCurrency }),
  setDestinationAddress: (address) => set({ destinationAddress: address }),
  setReviewOpen: (reviewOpen) => set({ reviewOpen }),
  beginHandoff: () => set({ handoffPending: true }),
  reset: () => set(initialState),
}));
