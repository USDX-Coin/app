import { describe, test, expect } from "vitest";
import { resolveWalletCreateEnabled, WALLET_CREATE_DEV_API } from "@/lib/env";

// The "Buatkan saya wallet" switch (custodial-wallet.md §1, amandemen 21 Sep
// 2026, USDX-699): the button exists on the DEV build only. It is an allowlist
// so that a misconfigured or unknown backend URL never opens a button that must
// answer 503 in front of real users — prod keeps the "Segera hadir" pill.
describe("resolveWalletCreateEnabled", () => {
  describe("positive", () => {
    test("the dev API turns the button on without any flag", () => {
      expect(
        resolveWalletCreateEnabled({ explicit: undefined, useMock: false, apiBaseUrl: WALLET_CREATE_DEV_API }),
      ).toBe(true);
    });

    test("mock mode (local dev, the test suites) turns it on", () => {
      expect(resolveWalletCreateEnabled({ explicit: undefined, useMock: true, apiBaseUrl: "" })).toBe(true);
    });

    test('an explicit "true" opens it on any backend — how prod is opened later', () => {
      expect(
        resolveWalletCreateEnabled({ explicit: "true", useMock: false, apiBaseUrl: "https://api.usdx.co.id" }),
      ).toBe(true);
    });
  });

  describe("negative", () => {
    test("the production API keeps the pill", () => {
      expect(
        resolveWalletCreateEnabled({ explicit: undefined, useMock: false, apiBaseUrl: "https://api.usdx.co.id" }),
      ).toBe(false);
    });

    test("an unknown backend URL fails closed", () => {
      for (const apiBaseUrl of [
        "https://api-staging.usdx.co.id",
        "https://api-dev.usdx.co.id.evil.example",
        "http://api-dev.usdx.co.id",
        "https://api-dev.usdx.co.id/v2",
      ]) {
        expect(resolveWalletCreateEnabled({ explicit: undefined, useMock: false, apiBaseUrl })).toBe(false);
      }
    });

    test('an explicit "false" closes it even on the dev API and in mock mode', () => {
      expect(
        resolveWalletCreateEnabled({ explicit: "false", useMock: false, apiBaseUrl: WALLET_CREATE_DEV_API }),
      ).toBe(false);
      expect(resolveWalletCreateEnabled({ explicit: "false", useMock: true, apiBaseUrl: "" })).toBe(false);
    });
  });

  describe("edge case", () => {
    test("a flag value that is neither true nor false is ignored, not read as on", () => {
      for (const explicit of ["1", "TRUE", "yes", ""]) {
        expect(
          resolveWalletCreateEnabled({ explicit, useMock: false, apiBaseUrl: "https://api.usdx.co.id" }),
        ).toBe(false);
      }
    });
  });
});
