import { create } from "zustand";
import type { AmountCurrency } from "@/types";
import { MINT_CHAIN_ID } from "@/lib/constants";
import { uuidv7 } from "@/lib/uuid";

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
// Where the minted USDX goes (USDX-567, custodial-wallet.md §5.2). `custodial` =
// the user's own custodial wallet (address from the profile, nothing to type);
// `manual` = the typed / address-book / scanned address. The default is
// `custodial` — for a user WITHOUT a custodial wallet the hook ignores it and
// behaves exactly as before, so this default costs non-custodial users nothing.
export type MintDestinationSource = "custodial" | "manual";

interface MintState {
  chainId: string;
  amount: string;
  amountCurrency: AmountCurrency; // currency the user typed the amount in
  destinationAddress: string;
  destinationSource: MintDestinationSource;
  reviewOpen: boolean;
  handoffPending: boolean;
  // USDX-749 anti-dobel — `Idempotency-Key` of the purchase being filled in. It stays the same while
  // amount, currency and destination stay the same: a retry after a network error, or closing and
  // reopening the Ringkasan, re-sends it and the backend answers with the SAME order instead of a new
  // one. Any edit to the intent clears it; so does the handoff (the next purchase is a new intent).
  requestKey: string | null;
  ensureRequestKey: () => string;
  setAmount: (amount: string) => void;
  setAmountCurrency: (currency: AmountCurrency) => void;
  setDestinationAddress: (address: string) => void;
  setDestinationSource: (source: MintDestinationSource) => void;
  setReviewOpen: (open: boolean) => void;
  beginHandoff: () => void;
  reset: () => void;
}

const initialState = {
  chainId: MINT_CHAIN_ID,
  amount: "",
  amountCurrency: "USD" as AmountCurrency,
  destinationAddress: "",
  destinationSource: "custodial" as MintDestinationSource,
  reviewOpen: false,
  handoffPending: false,
  requestKey: null as string | null,
};

export const useMintStore = create<MintState>()((set, get) => ({
  ...initialState,
  ensureRequestKey: () => {
    const existing = get().requestKey;
    if (existing) return existing;
    const key = uuidv7();
    set({ requestKey: key });
    return key;
  },
  setAmount: (amount) =>
    set((s) => ({ amount, requestKey: amount === s.amount ? s.requestKey : null })),
  setAmountCurrency: (amountCurrency) =>
    set((s) => ({
      amountCurrency,
      requestKey: amountCurrency === s.amountCurrency ? s.requestKey : null,
    })),
  setDestinationAddress: (address) =>
    set((s) => ({
      destinationAddress: address,
      requestKey: address === s.destinationAddress ? s.requestKey : null,
    })),
  setDestinationSource: (destinationSource) =>
    set((s) => ({
      destinationSource,
      requestKey: destinationSource === s.destinationSource ? s.requestKey : null,
    })),
  setReviewOpen: (reviewOpen) => set({ reviewOpen }),
  beginHandoff: () => set({ handoffPending: true, requestKey: null }),
  reset: () => set(initialState),
}));
