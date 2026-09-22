import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import {
  RELOGIN_INTENT_KEY,
  markReloginIntent,
  reloginLanding,
  takeReloginIntent,
} from "@/lib/auth/relogin-intent";

// Penanda tujuan "login ulang" (custodial-wallet.md §5.1 "PIN di web" + "Lupa PIN
// di web"; USDX-697, dibagi dengan USDX-696): per tab, tidak memuat PIN, dibuang
// sesudah dipakai.
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("relogin intent", () => {
  describe("positive", () => {
    test("create-pin lands on /settings after login", () => {
      markReloginIntent("create-pin");
      expect(reloginLanding()).toBe("/settings");
    });

    test("the landing screen takes the intent once — it is gone afterwards", () => {
      markReloginIntent("create-pin");
      expect(takeReloginIntent("create-pin")).toBe(true);
      expect(takeReloginIntent("create-pin")).toBe(false);
      expect(reloginLanding()).toBeNull();
    });

    test("forgot-pin (USDX-696) also lands on /settings and is taken on its own name", () => {
      markReloginIntent("forgot-pin");
      expect(reloginLanding()).toBe("/settings");
      expect(takeReloginIntent("forgot-pin")).toBe(true);
      expect(reloginLanding()).toBeNull();
    });

    test("reading the landing does not consume the intent (the landing screen does)", () => {
      markReloginIntent("create-pin");
      reloginLanding();
      expect(takeReloginIntent("create-pin")).toBe(true);
    });
  });

  describe("negative", () => {
    test("no intent → no landing, nothing to take", () => {
      expect(reloginLanding()).toBeNull();
      expect(takeReloginIntent("create-pin")).toBe(false);
    });

    test("an unknown value in storage is ignored and never becomes a redirect", () => {
      sessionStorage.setItem(RELOGIN_INTENT_KEY, "https://evil.example");
      expect(reloginLanding()).toBeNull();
      expect(takeReloginIntent("create-pin")).toBe(false);
    });
  });

  describe("edge case", () => {
    test("taking the other intent leaves the marker in place — create-pin and forgot-pin never swallow each other", () => {
      markReloginIntent("forgot-pin");
      expect(takeReloginIntent("create-pin")).toBe(false);
      expect(takeReloginIntent("forgot-pin")).toBe(true);
    });

    test("lives in sessionStorage (per tab), never in localStorage, and holds only the intent name", () => {
      markReloginIntent("create-pin");
      expect(sessionStorage.getItem(RELOGIN_INTENT_KEY)).toBe("create-pin");
      expect(localStorage.length).toBe(0);
    });

    test("storage that throws (private mode, blocked) → behaves as no intent, never crashes", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(() => markReloginIntent("create-pin")).not.toThrow();
      expect(reloginLanding()).toBeNull();
      expect(takeReloginIntent("create-pin")).toBe(false);
    });
  });
});
