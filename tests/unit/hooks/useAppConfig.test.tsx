import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useAppConfig } from "@/hooks/useAppConfig";
import { getAppConfig } from "@/lib/api/config-api";
import type { AppConfig } from "@/types";

vi.mock("@/lib/api/config-api", () => ({ getAppConfig: vi.fn() }));
const getAppConfigMock = vi.mocked(getAppConfig);

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    minMintIdr: "20000.00",
    minRedeemIdr: "20000.00",
    mintFeePct: "1.0",
    pgFeeVaFlat: "4000.00",
    contractAddress: "0x1FF2000000000000000000000000000000000000",
    chain: "polygon",
    ...overrides,
  };
}

beforeEach(() => {
  getAppConfigMock.mockReset();
  getAppConfigMock.mockResolvedValue(config());
});

// GET /api/v2/config (USDX-635/636) — the app's only runtime configuration.
describe("useAppConfig", () => {
  describe("positive", () => {
    test("parses the decimal strings once, at the edge", async () => {
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.minMintIdr).toBe(20_000);
      expect(result.current.minRedeemIdr).toBe(20_000);
      expect(result.current.mintFeePct).toBe(1);
      expect(result.current.pgFeeVaFlat).toBe(4_000);
      expect(result.current.contractAddress).toBe(
        "0x1FF2000000000000000000000000000000000000",
      );
    });

    // USDX-683: the payout-simulated answer belongs to the backend. Tri-state, so
    // all three readings are pinned here — the redeem tracker shows its banner on
    // `true` alone.
    test("reports the payout as simulated when the backend says so", async () => {
      getAppConfigMock.mockResolvedValue(config({ redeemPayoutSimulated: true }));
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.redeemPayoutSimulated).toBe(true);
    });

    test("reports the payout as real when the backend says so", async () => {
      getAppConfigMock.mockResolvedValue(config({ redeemPayoutSimulated: false }));
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.redeemPayoutSimulated).toBe(false);
    });

    test("reports TEST and the test token when the test bundle is in force", async () => {
      getAppConfigMock.mockResolvedValue(
        config({
          mintMode: "TEST",
          testContractAddress: "0x2702000000000000000000000000000000000000",
        }),
      );
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.mintMode).toBe("TEST");
      expect(result.current.testContractAddress).toBe(
        "0x2702000000000000000000000000000000000000",
      );
      // The production address is untouched by the mode.
      expect(result.current.contractAddress).toBe(
        "0x1FF2000000000000000000000000000000000000",
      );
    });
  });

  describe("negative", () => {
    test("a failed load reports error and hands back NO numbers", async () => {
      getAppConfigMock.mockRejectedValue(new Error("500"));
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
      expect(result.current.isReady).toBe(false);
      expect(result.current.minMintIdr).toBeNull();
      expect(result.current.minRedeemIdr).toBeNull();
      expect(result.current.pgFeeVaFlat).toBeNull();
      expect(result.current.contractAddress).toBeNull();
      // An unknown mode must never read as a test one.
      expect(result.current.mintMode).toBe("PROD");
      // A failed load knows nothing about the payout adapter either — and "nothing
      // known" must not become a claim in either direction (USDX-683).
      expect(result.current.redeemPayoutSimulated).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("mintMode missing from the response means PROD (USDX-636 not shipped yet)", async () => {
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.config?.mintMode).toBeUndefined();
      expect(result.current.mintMode).toBe("PROD");
    });

    test("an absent mintAvailable means the user may mint", async () => {
      // The gate arrives with USDX-636. A missing gate must never read as a
      // closed one, or shipping the FE first would take mint away from everyone.
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.config?.mintAvailable).toBeUndefined();
      expect(result.current.mintAvailable).toBe(true);
    });

    test("mintAvailable false is the only thing that closes the gate", async () => {
      getAppConfigMock.mockResolvedValue(config({ mintAvailable: false }));
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.mintAvailable).toBe(false);
    });

    test("a failed config load does NOT close the mint gate on its own", async () => {
      // A network blip is not a maintenance window. `isReady` already stops the
      // form; conflating the two would show the wrong explanation.
      getAppConfigMock.mockRejectedValue(new Error("500"));
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
      expect(result.current.mintAvailable).toBe(true);
    });

    // USDX-682: `minRedeemIdr` arrives with the BACKEND half of this ticket, which
    // merges after this app does. Both facts below are what make shipping the app
    // first safe.
    test("an absent minRedeemIdr is null, not 0 and not a guessed floor", async () => {
      const { minRedeemIdr: _dropped, ...withoutRedeemMin } = config();
      getAppConfigMock.mockResolvedValue(withoutRedeemMin);
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.minMintIdr).toBe(20_000));
      expect(result.current.config?.minRedeemIdr).toBeUndefined();
      expect(result.current.minRedeemIdr).toBeNull();
    });

    test("an absent minRedeemIdr does not make the config un-ready", async () => {
      // `isReady` gates the MINT screen. Folding the redeem field into it would
      // switch mint off for the whole rollout window, for a field mint never uses.
      const { minRedeemIdr: _dropped, ...withoutRedeemMin } = config();
      getAppConfigMock.mockResolvedValue(withoutRedeemMin);
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
    });

    test("an absent redeemPayoutSimulated is null — NOT KNOWN, not false", async () => {
      // The backend half of USDX-683 merges after this app, so for the whole
      // rollout window the field is simply missing. `false` would be a claim the
      // app cannot back up; `null` is the honest reading and shows no banner.
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.config?.redeemPayoutSimulated).toBeUndefined();
      expect(result.current.redeemPayoutSimulated).toBeNull();
    });

    test("an absent testContractAddress reads exactly like null", async () => {
      // The field does not exist until USDX-636 ships; "absent" and "null" must
      // not take different code paths.
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.config?.testContractAddress).toBeUndefined();
      expect(result.current.testContractAddress).toBeNull();
    });

    test("an unparseable number stays null instead of collapsing to 0", async () => {
      // 0 is a plausible minimum and a plausible fee, so it must never be what a
      // malformed field turns into.
      getAppConfigMock.mockResolvedValue(
        config({ minMintIdr: "", minRedeemIdr: "abc", pgFeeVaFlat: "abc" }),
      );
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.mintFeePct).toBe(1));
      expect(result.current.minMintIdr).toBeNull();
      expect(result.current.minRedeemIdr).toBeNull();
      expect(result.current.pgFeeVaFlat).toBeNull();
      expect(result.current.isReady).toBe(false);
    });

    test("a null contractAddress does not make the mint numbers unusable", async () => {
      // The address is for the balance panel; the mint screen only needs the
      // three money fields (USDX-635 § chain env kosong → contractAddress null).
      getAppConfigMock.mockResolvedValue(config({ contractAddress: null }));
      const { result } = renderHook(() => useAppConfig(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.contractAddress).toBeNull();
    });
  });
});
