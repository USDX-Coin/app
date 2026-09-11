import { describe, test, expect, beforeEach } from "vitest";
import { mockCreateRedeemOrder, mockGetRedeemOrder, mockReportBurnTx } from "@/lib/api/mock-api";
import {
  mockGetCustodialWallet,
  seedMockCustodialWallet,
  resetMockCustodialWallet,
  MOCK_CUSTODIAL_ADDRESS,
  MOCK_PIN,
} from "@/lib/api/mock-custodial-wallet";

// Redeem, custodial burn path (redeem.yaml § burnMode, custodial-wallet.md §5.3,
// USDX-565/567). `burnMode` is decided by the backend from `userAddress`; the
// PIN is the user's only approval; the burn is dispatched by the system and only
// the hash lands on the order — the scanner still owns the status.
const EXTERNAL = "0xC0FFEE0000000000000000000000000000C0FFEE";
const base = {
  amount: "100",
  amountCurrency: "USD" as const,
  chain: "polygon",
  bankCode: "014",
  bankAccountNumber: "1234563210",
  bankAccountName: "SINGGIH BRILIAN TARA",
};
const custodialReq = { ...base, userAddress: MOCK_CUSTODIAL_ADDRESS, pin: MOCK_PIN };

beforeEach(() => {
  resetMockCustodialWallet();
});

describe("mockCreateRedeemOrder — custodial", () => {
  describe("positive", () => {
    test("custodial address + PIN → burnMode CUSTODIAL, order AWAITING_BURN", async () => {
      seedMockCustodialWallet({ balance: "500.00" });
      const order = await mockCreateRedeemOrder(custodialReq);
      expect(order.burnMode).toBe("CUSTODIAL");
      expect(order.userAddress).toBe(MOCK_CUSTODIAL_ADDRESS);
      expect(order.status).toBe("AWAITING_BURN");
    });

    test(
      "the dispatcher stamps the burn hash without the client, then the scanner advances it",
      async () => {
        seedMockCustodialWallet({ balance: "500.00" });
        const order = await mockCreateRedeemOrder(custodialReq);
        const fresh = await mockGetRedeemOrder(order.id);
        expect(fresh.burnTxHash).toBeNull(); // not dispatched yet
        expect(fresh.burnMode).toBe("CUSTODIAL");

        await new Promise((r) => setTimeout(r, 1_700));
        const dispatched = await mockGetRedeemOrder(order.id);
        expect(dispatched.burnTxHash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(dispatched.burnSubmittedAt).not.toBeNull();
        expect(dispatched.status).toBe("AWAITING_BURN"); // "memproses burn"
        // The custodial balance drops by what was burned.
        expect((await mockGetCustodialWallet()).balance).toBe("400.00");

        await new Promise((r) => setTimeout(r, 2_600));
        expect((await mockGetRedeemOrder(order.id)).status).toBe("BURNED");
      },
      15_000,
    );
  });

  describe("negative", () => {
    test("custodial path without a PIN → 422 VALIDATION_ERROR", async () => {
      seedMockCustodialWallet();
      await expect(mockCreateRedeemOrder({ ...custodialReq, pin: undefined })).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
    });

    test("wrong PIN → 401 INVALID_PIN", async () => {
      seedMockCustodialWallet();
      await expect(mockCreateRedeemOrder({ ...custodialReq, pin: "000000" })).rejects.toMatchObject({
        status: 401,
        code: "INVALID_PIN",
      });
    });

    test("SUSPENDED wallet → 409 WALLET_NOT_ACTIVE, before any order exists", async () => {
      seedMockCustodialWallet({ status: "SUSPENDED" });
      await expect(mockCreateRedeemOrder(custodialReq)).rejects.toMatchObject({
        status: 409,
        code: "WALLET_NOT_ACTIVE",
      });
    });

    test("custodial balance below the amount → 422 INSUFFICIENT_BALANCE", async () => {
      seedMockCustodialWallet({ balance: "10.00" });
      await expect(mockCreateRedeemOrder(custodialReq)).rejects.toMatchObject({
        status: 422,
        code: "INSUFFICIENT_BALANCE",
      });
    });

    test("burn-tx report on a CUSTODIAL order → 409 INVALID_ORDER_STATE", async () => {
      seedMockCustodialWallet();
      const order = await mockCreateRedeemOrder(custodialReq);
      await expect(mockReportBurnTx(order.id, "0x" + "ab".repeat(32))).rejects.toMatchObject({
        status: 409,
        code: "INVALID_ORDER_STATE",
      });
    });
  });

  describe("edge case", () => {
    test("an external address is SELF_SIGN and needs no PIN — the existing path is untouched", async () => {
      seedMockCustodialWallet();
      const order = await mockCreateRedeemOrder({ ...base, userAddress: EXTERNAL });
      expect(order.burnMode).toBe("SELF_SIGN");
      const detail = await mockGetRedeemOrder(order.id);
      expect(detail.burnTxHash).toBeNull(); // nothing is dispatched for self-sign
    });

    test("without any custodial wallet, the custodial address is just another external address", async () => {
      const order = await mockCreateRedeemOrder({ ...base, userAddress: MOCK_CUSTODIAL_ADDRESS });
      expect(order.burnMode).toBe("SELF_SIGN");
    });
  });
});
