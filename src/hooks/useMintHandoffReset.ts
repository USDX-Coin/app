"use client";

// Post-handoff cleanup for /mint (handoff-return fix, 14 Agu 2026).
//
// The mint flow ends in a cross-origin handoff: `window.location.href =
// {checkoutUrl}/checkout/{orderId}` (useMint). Pressing Back on checkout does NOT
// re-run the app. The browser restores /mint from the back-forward cache exactly
// as it was left — Ringkasan modal still open, amount + address still filled, and
// every bit of React/TanStack state back to how it was, including a create
// mutation that has settled to idle. The confirm button is live again, and one
// click creates a SECOND order with a SECOND VA for a mint the user already paid.
//
// Two ways back to cover:
//   1. bfcache restore — `pageshow` fires with `persisted: true` on a page that
//      never unloaded, so the store still carries `handoffPending` from before the
//      handoff. That flag is the proof this screen is a post-handoff leftover.
//   2. fresh load (bfcache miss/eviction, Cmd-R, deep link) — the module-scope
//      store is constructed empty, so the screen is already clean. The mount pass
//      below is the belt to that braces: it also covers a restored page whose tree
//      remounts, and it fails safe if `mintStore` ever gains persist middleware.
//
// What must NOT be wiped: someone who fills the form and merely switches tabs,
// minimises, or locks the screen. That fires `visibilitychange`/`blur` — never
// `pageshow` — and never sets `handoffPending`, so both guards below leave their
// input exactly where it was. `persisted: false` (an ordinary load, where pageshow
// also fires) is ignored for the same reason.

import { useEffect } from "react";
import { useMintStore } from "@/stores/mintStore";

export function useMintHandoffReset() {
  useEffect(() => {
    // Mount pass: a tree that comes up with the handoff flag still set is showing
    // state left over from a completed handoff, never fresh input.
    if (useMintStore.getState().handoffPending) useMintStore.getState().reset();

    function onPageShow(event: PageTransitionEvent) {
      // Only a bfcache restore replays a live page; an ordinary load already
      // starts from an empty store.
      if (!event.persisted) return;
      const state = useMintStore.getState();
      // No handoff on this page → the user went somewhere else and came back
      // (or the form was never submitted). Their input is theirs; keep it.
      if (!state.handoffPending) return;
      state.reset();
    }

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
}
