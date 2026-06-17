import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";

vi.mock("@/lib/api/mint-api", () => ({
  getMintOrder: vi.fn(),
  payMintOrder: vi.fn(),
}));

import { getMintOrder, payMintOrder } from "@/lib/api/mint-api";
import { useCheckout } from "@/hooks/useCheckout";
import type { MintOrderDetail } from "@/types";

const mockGet = getMintOrder as unknown as ReturnType<typeof vi.fn>;
const mockPay = payMintOrder as unknown as ReturnType<typeof vi.fn>;

function makeOrder(o: Partial<MintOrderDetail> = {}): MintOrderDetail {
  return {
    id: "mint_1",
    orderNumber: "USDX-1",
    customerName: "Demo",
    type: "MINT",
    userAddress: "0xabc",
    chain: "polygon",
    inputCurrency: "USD",
    amount: "100",
    baseRate: "16000",
    spreadBuyPct: "2.5",
    effectiveRate: "16400",
    subtotalIdr: "1640000",
    mintFeePct: "1",
    mintFeeIdr: "16400",
    totalBeforePgFeeIdr: "1656400",
    paymentChannel: null,
    pgFeeIdr: null,
    totalFeeIdr: null,
    totalPayIdr: null,
    paymentBank: null,
    paymentStatus: "REQUESTED",
    safeStatus: "NONE",
    status: "WAITING_FOR_PAYMENT",
    paymentProvider: "MOCK",
    virtualAccountNo: null,
    paymentUrl: null,
    paymentRef: null,
    paidAt: null,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    safeTxHash: null,
    onChainTxHash: null,
    createdAt: "2026-06-17T00:00:00Z",
    updatedAt: "2026-06-17T00:00:00Z",
    ...o,
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockPay.mockReset();
});

describe("useCheckout", () => {
  describe("positive", () => {
    test("loads the order; future expiresAt → not expired, countdown > 0", async () => {
      mockGet.mockResolvedValue(makeOrder());
      const { result } = renderHook(() => useCheckout("mint_1"), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.order).not.toBeNull());
      expect(result.current.isExpired).toBe(false);
      expect(result.current.secondsLeft).toBeGreaterThan(0);
    });

    test("pay() calls payMintOrder with channel+bank and updates the cached order", async () => {
      mockGet.mockResolvedValue(makeOrder());
      mockPay.mockResolvedValue(
        makeOrder({
          paymentStatus: "WAITING_FOR_PAYMENT",
          paymentChannel: "VA",
          paymentBank: "BCA",
          virtualAccountNo: "8808123456",
        }),
      );
      const { result } = renderHook(() => useCheckout("mint_1"), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.order).not.toBeNull());

      await act(async () => {
        await result.current.pay("VA", "BCA");
      });

      expect(mockPay).toHaveBeenCalledWith("mint_1", { channel: "VA", bank: "BCA" });
      await waitFor(() => expect(result.current.order?.virtualAccountNo).toBe("8808123456"));
    });
  });

  describe("edge cases", () => {
    test("past expiresAt (non-terminal) → isExpired true, countdown 0", async () => {
      mockGet.mockResolvedValue(makeOrder({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
      const { result } = renderHook(() => useCheckout("mint_1"), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.order).not.toBeNull());
      expect(result.current.secondsLeft).toBe(0);
      expect(result.current.isExpired).toBe(true);
    });

    test("COMPLETED order is not 'expired' even past expiresAt", async () => {
      mockGet.mockResolvedValue(
        makeOrder({
          status: "COMPLETED",
          paymentStatus: "PAID",
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
      );
      const { result } = renderHook(() => useCheckout("mint_1"), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.order).not.toBeNull());
      expect(result.current.isExpired).toBe(false);
      expect(result.current.isTerminal).toBe(true);
    });
  });
});
