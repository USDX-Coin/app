import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { UsdxBalanceRead } from "@/lib/redeem/wallet";
import { useWalletBalance } from "@/hooks/useWalletBalance";

// The balance is read on-chain via wagmi and there is no WagmiProvider in jsdom,
// so stub the shared read and assert the state machine built on top of it
// (USDX-396). The invariant under test is the money-safety one: a number reaches
// the UI ONLY in the "ready" state.
const read = vi.hoisted(() => ({
  current: {} as UsdxBalanceRead,
}));

vi.mock("@/lib/redeem/wallet", () => ({
  useUsdxBalance: () => read.current,
}));

function setRead(partial: Partial<UsdxBalanceRead>) {
  read.current = { ...read.current, ...partial };
}

describe("useWalletBalance", () => {
  beforeEach(() => {
    read.current = {
      isConnected: false,
      address: undefined,
      connect: () => {},
      balanceUsdx: null,
      isBalanceLoading: false,
      isBalanceUnavailable: false,
    };
  });

  describe("positive", () => {
    test("reports ready with the on-chain balance and its USD equivalent", () => {
      setRead({ isConnected: true, address: "0xabc", balanceUsdx: 83.5 });

      const { result } = renderHook(() => useWalletBalance());

      expect(result.current.state).toBe("ready");
      expect(result.current.balanceUsdx).toBe(83.5);
      expect(result.current.balanceUsd).toBe(83.5); // 1 USDX = 1 USD peg
      expect(result.current.address).toBe("0xabc");
    });

    test("passes connect and isConnected straight through from the wallet read", () => {
      const connect = vi.fn();
      setRead({ isConnected: true, connect, balanceUsdx: 1 });

      const { result } = renderHook(() => useWalletBalance());
      result.current.connect();

      expect(result.current.isConnected).toBe(true);
      expect(connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("negative", () => {
    test("no wallet connected → disconnected, and NO number", () => {
      const { result } = renderHook(() => useWalletBalance());

      expect(result.current.state).toBe("disconnected");
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceUsd).toBeNull();
    });

    test("read in flight → loading, and NO number", () => {
      setRead({ isConnected: true, isBalanceLoading: true });

      const { result } = renderHook(() => useWalletBalance());

      expect(result.current.state).toBe("loading");
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceUsd).toBeNull();
    });

    test("connected but the read failed → unavailable, and NO number", () => {
      setRead({ isConnected: true, isBalanceUnavailable: true });

      const { result } = renderHook(() => useWalletBalance());

      expect(result.current.state).toBe("unavailable");
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceUsd).toBeNull();
    });

    test("a number from a non-ready read is never passed through", () => {
      // Defence in depth: even if the underlying read hands back a leftover
      // number while still loading, the UI must not see it.
      setRead({ isConnected: true, isBalanceLoading: true, balanceUsdx: 999105.89 });

      const { result } = renderHook(() => useWalletBalance());

      expect(result.current.state).toBe("loading");
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceUsd).toBeNull();
    });

    test("disconnecting a wallet that had a balance drops the number", () => {
      setRead({ isConnected: true, balanceUsdx: 500 });
      const { result, rerender } = renderHook(() => useWalletBalance());
      expect(result.current.balanceUsdx).toBe(500);

      setRead({ isConnected: false, address: undefined });
      rerender();

      expect(result.current.state).toBe("disconnected");
      expect(result.current.balanceUsdx).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("a genuine zero balance is ready and shown as 0, not as unknown", () => {
      setRead({ isConnected: true, address: "0xabc", balanceUsdx: 0 });

      const { result } = renderHook(() => useWalletBalance());

      expect(result.current.state).toBe("ready");
      expect(result.current.balanceUsdx).toBe(0);
      expect(result.current.balanceUsd).toBe(0);
    });

    test("loading wins over unavailable when both are set", () => {
      setRead({ isConnected: true, isBalanceLoading: true, isBalanceUnavailable: true });

      const { result } = renderHook(() => useWalletBalance());

      expect(result.current.state).toBe("loading");
    });
  });
});
