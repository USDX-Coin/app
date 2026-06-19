import { describe, test, expect } from "vitest";
import {
  mockGetConsumerRate,
  mockListAddressBook,
  mockAddAddressBook,
  mockDeleteAddressBook,
  mockCreateMintOrder,
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
      const entry = await mockAddAddressBook({ address: "0x1111111111111111111111111111111111111111", label: "Alice" });
      expect(entry.id).toMatch(/^addr_/);
      expect(entry.label).toBe("Alice");
      const list = await mockListAddressBook();
      expect(list.some((e) => e.id === entry.id)).toBe(true);
    });
  });

  describe("negative", () => {
    test("rejects a duplicate address with 409 ADDRESS_ALREADY_EXISTS", async () => {
      const address = "0x2222222222222222222222222222222222222222";
      await mockAddAddressBook({ address, label: "first" });
      await expect(mockAddAddressBook({ address, label: "again" })).rejects.toMatchObject({
        status: 409,
        code: "ADDRESS_ALREADY_EXISTS",
      });
    });

    // USDX-214: body validation on /api/v2/* surfaces 422 VALIDATION_ERROR (not 400).
    test("rejects a label over 50 chars with 422 VALIDATION_ERROR", async () => {
      await expect(
        mockAddAddressBook({
          address: "0x3333333333333333333333333333333333333333",
          label: "x".repeat(51),
        }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    test("rejects an empty label with 422 VALIDATION_ERROR", async () => {
      await expect(
        mockAddAddressBook({ address: "0x4444444444444444444444444444444444444444", label: "   " }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    test("rejects an invalid EVM address with 422 VALIDATION_ERROR", async () => {
      await expect(
        mockAddAddressBook({ address: "0x123", label: "Bad" }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    test("delete of an unknown id throws 404", async () => {
      await expect(mockDeleteAddressBook("addr_nope")).rejects.toMatchObject({ status: 404 });
    });
  });
});

// Pay + status (GET/pay) dipindah ke repo `checkout` (USDX-225); app mock hanya
// CREATE (order tetap REQUESTED) + feeds history. Lifecycle tracker diuji di checkout.
describe("mock mint v2 create", () => {
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
  });

  describe("negative", () => {
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
