import { describe, test, expect, vi, beforeEach } from "vitest";

// Force the real-backend branch so signAndBroadcastBurn drives the injected
// on-chain executor instead of the mock simulation (USDX-263).
vi.mock("@/lib/env", () => ({ env: { useMock: false } }));
// The mock layer is imported by burn.ts but never called on the real branch.
vi.mock("@/lib/api/mock-api", () => ({ mockBroadcastRedeemBurn: vi.fn() }));

import { signAndBroadcastBurn } from "@/lib/redeem/burn";
import { mockBroadcastRedeemBurn } from "@/lib/api/mock-api";
import type { RedeemOrderCreated } from "@/types";

const order = {
  id: "rdm_1",
  redeemId: "0x" + "ab".repeat(32),
  amountWei: "100000000", // 100 USDX @ 6 decimals
  contractAddress: "0x1111111111111111111111111111111111111111",
} as RedeemOrderCreated;

const FROM = "0x000000C528aE908fB929a0898B65e913623c9aFf";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signAndBroadcastBurn (real on-chain branch)", () => {
  describe("positive", () => {
    test("calls the executor with the burn args (amountWei as bigint) and returns the broadcast hash", async () => {
      const hash = ("0x" + "cd".repeat(32)) as `0x${string}`;
      const executor = vi.fn().mockResolvedValue(hash);

      await expect(signAndBroadcastBurn(order, FROM, executor)).resolves.toEqual({
        burnTxHash: hash,
      });

      expect(executor).toHaveBeenCalledWith({
        contractAddress: order.contractAddress,
        redeemId: order.redeemId,
        amountWei: BigInt("100000000"),
        account: FROM,
      });
      // Real branch must not touch the mock simulation.
      expect(mockBroadcastRedeemBurn).not.toHaveBeenCalled();
    });
  });

  describe("negative", () => {
    test("propagates a rejected/failed signature so the caller can retry", async () => {
      const executor = vi.fn().mockRejectedValue(new Error("User rejected the request"));
      await expect(signAndBroadcastBurn(order, FROM, executor)).rejects.toThrow(/rejected/i);
    });
  });
});
