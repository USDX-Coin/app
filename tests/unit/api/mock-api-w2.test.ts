import { describe, test, expect } from "vitest";
import {
  mockGetConsumerRate,
  mockListAddressBook,
  mockAddAddressBook,
  mockDeleteAddressBook,
  mockCreateMintOrder,
  mockPayMintOrder,
  mockGetMintOrder,
  mockListConsumerTransactions,
  MOCK_BLACKLISTED_ADDRESS,
} from "@/lib/api/mock-api";

// Mock W2 layer (USDX-205). State is module-scoped, so tests use distinct
// addresses to stay isolated; the duplicate test deliberately adds twice.

describe("mockGetConsumerRate", () => {
  describe("positive", () => {
    test("derives effectiveBuyRate from baseRate × (1 + spreadBuyPct/100)", async () => {
      const rate = await mockGetConsumerRate();
      expect(rate.baseRate).toBe("16000.00");
      expect(rate.spreadBuyPct).toBe("2.5");
      expect(rate.effectiveBuyRate).toBe("16400.00");
      expect(typeof rate.updatedAt).toBe("string");
    });
  });
});

describe("mock address book", () => {
  describe("positive", () => {
    test("adds an entry and lists it back", async () => {
      const entry = await mockAddAddressBook({ address: "0xList0000000000000000000000000000000000001", label: "Alice" });
      expect(entry.id).toMatch(/^addr_/);
      expect(entry.label).toBe("Alice");
      const list = await mockListAddressBook();
      expect(list.some((e) => e.id === entry.id)).toBe(true);
    });
  });

  describe("negative", () => {
    test("rejects a duplicate address with 409 ADDRESS_ALREADY_EXISTS", async () => {
      const address = "0xDup00000000000000000000000000000000000002";
      await mockAddAddressBook({ address, label: "first" });
      await expect(mockAddAddressBook({ address, label: "again" })).rejects.toMatchObject({
        status: 409,
        code: "ADDRESS_ALREADY_EXISTS",
      });
    });

    test("delete of an unknown id throws 404", async () => {
      await expect(mockDeleteAddressBook("addr_nope")).rejects.toMatchObject({ status: 404 });
    });
  });
});

describe("mock mint v2 lifecycle", () => {
  describe("positive", () => {
    test("create returns a REQUESTED order with VA (banks) + QRIS (no banks) channels", async () => {
      const order = await mockCreateMintOrder({
        userAddress: "0xMint00000000000000000000000000000000000a",
        amount: "100",
        amountCurrency: "USD",
        chain: "polygon",
      });
      expect(order.paymentStatus).toBe("REQUESTED");
      expect(order.safeStatus).toBe("NONE");
      expect(order.status).toBe("WAITING_FOR_PAYMENT");
      const va = order.channels.find((c) => c.channel === "VA");
      const qris = order.channels.find((c) => c.channel === "QRIS");
      expect(va?.banks?.length).toBeGreaterThan(0);
      expect(qris?.banks).toBeNull();
    });

    test("pay sets WAITING_FOR_PAYMENT + a VA number + total to pay", async () => {
      const order = await mockCreateMintOrder({
        userAddress: "0xMint00000000000000000000000000000000000b",
        amount: "50",
        amountCurrency: "USD",
        chain: "polygon",
      });
      const paid = await mockPayMintOrder(order.id, { channel: "VA", bank: "BCA" });
      expect(paid.paymentStatus).toBe("WAITING_FOR_PAYMENT");
      expect(paid.paymentChannel).toBe("VA");
      expect(paid.paymentBank).toBe("BCA");
      expect(paid.virtualAccountNo).toBeTruthy();
      expect(paid.totalPayIdr).toBeTruthy();
      // mock bookkeeping field must not leak into the returned detail
      expect("paidEligibleAt" in paid).toBe(false);
    });
  });

  describe("negative", () => {
    test("paying twice throws 409 INVALID_ORDER_STATE", async () => {
      const order = await mockCreateMintOrder({
        userAddress: "0xMint00000000000000000000000000000000000c",
        amount: "10",
        amountCurrency: "USD",
        chain: "polygon",
      });
      await mockPayMintOrder(order.id, { channel: "QRIS" });
      await expect(mockPayMintOrder(order.id, { channel: "QRIS" })).rejects.toMatchObject({
        status: 409,
        code: "INVALID_ORDER_STATE",
      });
    });

    test("get of an unknown order throws 404", async () => {
      await expect(mockGetMintOrder("mint_nope")).rejects.toMatchObject({ status: 404 });
    });

    test("create rejects a blacklisted recipient with 422 RECIPIENT_BLACKLISTED", async () => {
      await expect(
        mockCreateMintOrder({
          userAddress: MOCK_BLACKLISTED_ADDRESS,
          amount: "100",
          amountCurrency: "USD",
          chain: "polygon",
        }),
      ).rejects.toMatchObject({ status: 422, code: "RECIPIENT_BLACKLISTED" });
    });
  });
});

describe("mockListConsumerTransactions", () => {
  describe("positive", () => {
    test("returns paginated mint history with metadata", async () => {
      const result = await mockListConsumerTransactions({ page: 1, take: 5, type: "MINT" });
      expect(result.data.length).toBeLessThanOrEqual(5);
      expect(result.metadata.page).toBe(1);
      expect(result.metadata.limit).toBe(5);
      expect(result.data.every((t) => t.type === "MINT")).toBe(true);
    });
  });
});
