import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMintHandoffReset } from "@/hooks/useMintHandoffReset";
import { useMintStore } from "@/stores/mintStore";

// Returning to /mint after the cross-origin checkout handoff.
// The defect: the browser restores the page from the back-forward cache exactly as
// it was left (Ringkasan open, form filled, confirm button live), so one click
// creates a second order + VA for a mint that was already paid.
// The line this hook must not cross: input that was never handed off — a plain tab
// switch, or a Back from somewhere that wasn't checkout — has to survive untouched.

const VALID_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

/** The screen exactly as the user left it: filled form, Ringkasan open. */
function fillFormWithReviewOpen() {
  useMintStore.getState().setAmount("10");
  useMintStore.getState().setDestinationAddress(VALID_ADDRESS);
  useMintStore.getState().setReviewOpen(true);
}

/**
 * `pageshow` as the browser fires it. `persisted: true` = restored from the
 * back-forward cache (Back from checkout); `false` = an ordinary load. jsdom has
 * no PageTransitionEvent, so the flag is pinned onto a plain Event.
 */
function firePageShow(persisted: boolean) {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: persisted });
  act(() => {
    window.dispatchEvent(event);
  });
}

function expectFormPreserved() {
  const state = useMintStore.getState();
  expect(state.amount).toBe("10");
  expect(state.destinationAddress).toBe(VALID_ADDRESS);
  expect(state.reviewOpen).toBe(true);
}

beforeEach(() => {
  useMintStore.getState().reset();
});

describe("useMintHandoffReset", () => {
  describe("positive", () => {
    test("bfcache restore after a handoff clears the form and closes the Ringkasan", () => {
      fillFormWithReviewOpen();
      useMintStore.getState().beginHandoff();
      renderHook(() => useMintHandoffReset());

      firePageShow(true);

      const state = useMintStore.getState();
      expect(state.reviewOpen).toBe(false); // modal-open-after-back
      expect(state.amount).toBe(""); // form-still-filled-after-back
      expect(state.destinationAddress).toBe("");
      expect(state.handoffPending).toBe(false); // ready for a genuinely new mint
    });

    test("a tree that mounts with the handoff still latched clears it (fresh load path)", () => {
      // Covers a restored page whose tree remounts, and fails safe if mintStore
      // ever gains persist middleware (today a real fresh load starts empty).
      fillFormWithReviewOpen();
      useMintStore.getState().beginHandoff();

      renderHook(() => useMintHandoffReset());

      const state = useMintStore.getState();
      expect(state.amount).toBe("");
      expect(state.reviewOpen).toBe(false);
      expect(state.handoffPending).toBe(false);
    });
  });

  describe("negative", () => {
    test("bfcache restore WITHOUT a handoff keeps the input (Back from anywhere else)", () => {
      fillFormWithReviewOpen();
      renderHook(() => useMintHandoffReset());

      firePageShow(true);

      expectFormPreserved();
    });

    test("an ordinary load (persisted: false) keeps the input", () => {
      fillFormWithReviewOpen();
      renderHook(() => useMintHandoffReset());

      firePageShow(false);

      expectFormPreserved();
    });

    test("switching tabs and coming back keeps the input", () => {
      // A tab switch fires visibilitychange/blur — never pageshow — and never
      // latches a handoff. Nothing here may touch the user's half-filled form.
      fillFormWithReviewOpen();
      renderHook(() => useMintHandoffReset());

      act(() => {
        window.dispatchEvent(new Event("blur"));
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      });

      expectFormPreserved();
    });
  });

  describe("edge cases", () => {
    test("nothing to clear: a bfcache restore of an untouched form is a no-op", () => {
      renderHook(() => useMintHandoffReset());

      firePageShow(true);

      const state = useMintStore.getState();
      expect(state.amount).toBe("");
      expect(state.reviewOpen).toBe(false);
    });

    test("the listener is detached on unmount (no cross-page wipes)", () => {
      fillFormWithReviewOpen();
      useMintStore.getState().beginHandoff();
      const { unmount } = renderHook(() => useMintHandoffReset());
      // Mount already consumed the latch; re-arm to prove the detached listener
      // is what stops the second wipe.
      fillFormWithReviewOpen();
      useMintStore.getState().beginHandoff();

      unmount();
      firePageShow(true);

      expectFormPreserved();
      expect(useMintStore.getState().handoffPending).toBe(true);
    });
  });
});
