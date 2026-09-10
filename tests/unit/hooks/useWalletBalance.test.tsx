import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { UsdxBalanceRead, UsdxTokenTarget } from "@/lib/redeem/wallet";
import {
  useWalletBalance,
  resolveBalanceTokens,
  type WalletBalance,
} from "@/hooks/useWalletBalance";
import { useAppConfig } from "@/hooks/useAppConfig";
import { USDX_CONTRACT_ADDRESS } from "@/lib/constants";

// The balance is read on-chain via wagmi and there is no WagmiProvider in jsdom,
// so stub the shared read and assert the state machine built on top of it
// (USDX-396). The invariant under test is the money-safety one: a number reaches
// the UI ONLY in the "ready" state.
//
// The stub is keyed by token address (USDX-640): the panel now reads two tokens,
// and the whole point is that they must not be confused for one another.
const reads = vi.hoisted(() => ({
  byToken: new Map<string, UsdxBalanceRead>(),
  fallback: {} as UsdxBalanceRead,
}));

vi.mock("@/lib/redeem/wallet", () => ({
  useUsdxBalance: (token?: UsdxTokenTarget) => {
    if (token === null) {
      // "Nothing to read" — the caller passed no token at all.
      return { ...reads.fallback, balanceUsdx: null, isBalanceLoading: false };
    }
    return reads.byToken.get(String(token).toLowerCase()) ?? reads.fallback;
  },
}));

vi.mock("@/hooks/useAppConfig", () => ({ useAppConfig: vi.fn() }));
const useAppConfigMock = vi.mocked(useAppConfig);

const PROD_TOKEN = "0x1FF2d7040000000000000000000000000000dcba" as const;
const TEST_TOKEN = "0x2702d7040000000000000000000000000000abcd" as const;

function setConfig(
  contractAddress: string | null,
  mintMode: "PROD" | "TEST" = "PROD",
  testContractAddress: string | null = null,
) {
  useAppConfigMock.mockReturnValue({
    config: null,
    minMintIdr: 20_000,
    mintFeePct: 1,
    pgFeeVaFlat: 4_000,
    contractAddress,
    testContractAddress,
    mintMode,
    isReady: true,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: () => {},
  });
}

function setRead(token: string, partial: Partial<UsdxBalanceRead>) {
  reads.byToken.set(token.toLowerCase(), { ...reads.fallback, ...partial });
}

function render(): { current: WalletBalance } {
  return renderHook(() => useWalletBalance()).result;
}

beforeEach(() => {
  reads.fallback = {
    isConnected: false,
    address: undefined,
    connect: () => {},
    balanceUsdx: null,
    isBalanceLoading: false,
    isBalanceUnavailable: false,
  };
  reads.byToken.clear();
  useAppConfigMock.mockReset();
  setConfig(USDX_CONTRACT_ADDRESS, "PROD");
});

// The whole safety rule of USDX-640, stated without a wallet: which token each
// surface reads, and when a second one may appear at all.
describe("resolveBalanceTokens", () => {
  const ENV = "0x1111111111111111111111111111111111111111" as const;
  const PROD = "0x2222222222222222222222222222222222222222" as const;
  const TEST = "0x3333333333333333333333333333333333333333" as const;

  describe("positive", () => {
    test("PROD reads the config's address — that is the point of the ticket", () => {
      expect(resolveBalanceTokens(PROD, null, "PROD", ENV)).toEqual({ main: PROD, test: null });
    });

    test("TEST reads the production token for the balance and the test one for the strip", () => {
      // `contractAddress` never changes meaning; the strip has its own field.
      expect(resolveBalanceTokens(PROD, TEST, "TEST", ENV)).toEqual({ main: PROD, test: TEST });
    });
  });

  describe("negative", () => {
    test("config not loaded → the env address, and no strip", () => {
      expect(resolveBalanceTokens(null, null, "PROD", ENV)).toEqual({ main: ENV, test: null });
      expect(resolveBalanceTokens(null, null, "TEST", ENV)).toEqual({ main: ENV, test: null });
    });

    test("a malformed address is ignored rather than passed to an RPC call", () => {
      expect(resolveBalanceTokens("not-an-address", null, "PROD", ENV).main).toBe(ENV);
      expect(resolveBalanceTokens(PROD, "0x1234", "TEST", ENV).test).toBeNull();
    });

    test("a test address that arrives in PROD mode is still not shown", () => {
      // The field is documented as non-null only in TEST, but a test strip on a
      // production session is the exact failure this hook exists to prevent.
      expect(resolveBalanceTokens(PROD, TEST, "PROD", ENV)).toEqual({ main: PROD, test: null });
    });
  });

  describe("edge cases", () => {
    test("TEST before USDX-636 ships — the field is absent → no strip", () => {
      expect(resolveBalanceTokens(PROD, undefined, "TEST", ENV)).toEqual({
        main: PROD,
        test: null,
      });
    });

    test("the main balance never becomes the test token, in any mode", () => {
      for (const mode of ["PROD", "TEST"] as const) {
        expect(resolveBalanceTokens(PROD, TEST, mode, ENV).main).toBe(PROD);
      }
      // Even with the config missing, the fallback is the production env address.
      expect(resolveBalanceTokens(null, TEST, "TEST", ENV).main).toBe(ENV);
    });
  });
});

describe("useWalletBalance", () => {
  describe("positive", () => {
    test("reports ready with the on-chain balance and its USD equivalent", () => {
      setRead(USDX_CONTRACT_ADDRESS, { isConnected: true, address: "0xabc", balanceUsdx: 83.5 });

      const result = render();

      expect(result.current.state).toBe("ready");
      expect(result.current.balanceUsdx).toBe(83.5);
      expect(result.current.balanceUsd).toBe(83.5); // 1 USDX = 1 USD peg
      expect(result.current.address).toBe("0xabc");
    });

    test("passes connect and isConnected straight through from the wallet read", () => {
      const connect = vi.fn();
      setRead(USDX_CONTRACT_ADDRESS, { isConnected: true, connect, balanceUsdx: 1 });

      const result = render();
      result.current.connect();

      expect(result.current.isConnected).toBe(true);
      expect(connect).toHaveBeenCalledTimes(1);
    });

    test("reads the token address the config returns, not the one from the build", () => {
      const fromConfig = "0x4444444444444444444444444444444444444444";
      setConfig(fromConfig, "PROD");
      setRead(fromConfig, { isConnected: true, balanceUsdx: 42 });
      setRead(USDX_CONTRACT_ADDRESS, { isConnected: true, balanceUsdx: 999 });

      expect(render().current.balanceUsdx).toBe(42);
    });
  });

  describe("negative", () => {
    test("no wallet connected → disconnected, and NO number", () => {
      const result = render();

      expect(result.current.state).toBe("disconnected");
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceUsd).toBeNull();
    });

    test("read in flight → loading, and NO number", () => {
      setRead(USDX_CONTRACT_ADDRESS, { isConnected: true, isBalanceLoading: true });

      const result = render();

      expect(result.current.state).toBe("loading");
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceUsd).toBeNull();
    });

    test("connected but the read failed → unavailable, and NO number", () => {
      setRead(USDX_CONTRACT_ADDRESS, { isConnected: true, isBalanceUnavailable: true });

      const result = render();

      expect(result.current.state).toBe("unavailable");
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceUsd).toBeNull();
    });

    test("a number from a non-ready read is never passed through", () => {
      // Defence in depth: even if the underlying read hands back a leftover
      // number while still loading, the UI must not see it.
      setRead(USDX_CONTRACT_ADDRESS, {
        isConnected: true,
        isBalanceLoading: true,
        balanceUsdx: 999105.89,
      });

      const result = render();

      expect(result.current.state).toBe("loading");
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceUsd).toBeNull();
    });

    test("disconnecting a wallet that had a balance drops the number", () => {
      setRead(USDX_CONTRACT_ADDRESS, { isConnected: true, balanceUsdx: 500 });
      const { result, rerender } = renderHook(() => useWalletBalance());
      expect(result.current.balanceUsdx).toBe(500);

      setRead(USDX_CONTRACT_ADDRESS, { isConnected: false, address: undefined });
      rerender();

      expect(result.current.state).toBe("disconnected");
      expect(result.current.balanceUsdx).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("a genuine zero balance is ready and shown as 0, not as unknown", () => {
      setRead(USDX_CONTRACT_ADDRESS, { isConnected: true, address: "0xabc", balanceUsdx: 0 });

      const result = render();

      expect(result.current.state).toBe("ready");
      expect(result.current.balanceUsdx).toBe(0);
      expect(result.current.balanceUsd).toBe(0);
    });

    test("loading wins over unavailable when both are set", () => {
      setRead(USDX_CONTRACT_ADDRESS, {
        isConnected: true,
        isBalanceLoading: true,
        isBalanceUnavailable: true,
      });

      expect(render().current.state).toBe("loading");
    });

    test("a failed config load keeps the env address — no blank, no fake 0", () => {
      useAppConfigMock.mockReturnValue({
        config: null,
        minMintIdr: null,
        mintFeePct: null,
        pgFeeVaFlat: null,
        contractAddress: null,
        testContractAddress: null,
        mintMode: "PROD",
        isReady: false,
        isLoading: false,
        isError: true,
        isFetching: false,
        refetch: () => {},
      });
      setRead(USDX_CONTRACT_ADDRESS, { isConnected: true, balanceUsdx: 77 });

      const result = render();

      expect(result.current.balanceUsdx).toBe(77);
      expect(result.current.testBalance).toBeNull();
    });
  });

  // The demo has to show a test mint landing in the wallet, without ever telling
  // a real USDX holder that their balance is 0 (USDX-640).
  describe("test-mint strip", () => {
    describe("positive", () => {
      test("TEST mode shows the test token in its own strip", () => {
        setConfig(PROD_TOKEN, "TEST", TEST_TOKEN);
        setRead(PROD_TOKEN, { isConnected: true, balanceUsdx: 1200 });
        setRead(TEST_TOKEN, { isConnected: true, balanceUsdx: 50 });

        const result = render();

        // Main balance: still the production token, untouched.
        expect(result.current.balanceUsdx).toBe(1200);
        expect(result.current.testBalance).toEqual({
          state: "ready",
          balanceUsdx: 50,
          address: TEST_TOKEN,
        });
      });

      test("the strip follows a refetch, so a completed test mint shows up", () => {
        setConfig(PROD_TOKEN, "TEST", TEST_TOKEN);
        setRead(PROD_TOKEN, { isConnected: true, balanceUsdx: 1200 });
        setRead(TEST_TOKEN, { isConnected: true, balanceUsdx: 0 });

        const { result, rerender } = renderHook(() => useWalletBalance());
        expect(result.current.testBalance?.balanceUsdx).toBe(0);

        setRead(TEST_TOKEN, { isConnected: true, balanceUsdx: 25 });
        rerender();

        expect(result.current.testBalance?.balanceUsdx).toBe(25);
        expect(result.current.balanceUsdx).toBe(1200); // main balance never moved
      });
    });

    describe("negative", () => {
      test("PROD mode has no strip at all", () => {
        setConfig(PROD_TOKEN, "PROD", TEST_TOKEN);
        setRead(TEST_TOKEN, { isConnected: true, balanceUsdx: 50 });

        expect(render().current.testBalance).toBeNull();
      });

      test("a real USDX holder never sees the main balance replaced by the test one", () => {
        // The failure this guards: swapping the address globally in TEST mode.
        setConfig(PROD_TOKEN, "TEST", TEST_TOKEN);
        setRead(PROD_TOKEN, { isConnected: true, balanceUsdx: 5_000 });
        setRead(TEST_TOKEN, { isConnected: true, balanceUsdx: 0 });

        const result = render();

        expect(result.current.balanceUsdx).toBe(5_000);
        expect(result.current.state).toBe("ready");
      });
    });

    describe("edge cases", () => {
      test("wallet disconnected in TEST mode → strip shows no number", () => {
        setConfig(PROD_TOKEN, "TEST", TEST_TOKEN);

        const result = render();

        expect(result.current.state).toBe("disconnected");
        expect(result.current.testBalance?.state).toBe("disconnected");
        expect(result.current.testBalance?.balanceUsdx).toBeNull();
      });

      test("TEST mode before USDX-636 ships (no testContractAddress) → no strip", () => {
        setConfig(PROD_TOKEN, "TEST", null);
        setRead(PROD_TOKEN, { isConnected: true, balanceUsdx: 12 });

        const result = render();

        expect(result.current.balanceUsdx).toBe(12);
        expect(result.current.testBalance).toBeNull();
      });
    });
  });
});
