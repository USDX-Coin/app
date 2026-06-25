import { describe, test, expect, afterEach } from "vitest";
import {
  mockGetConsumerRate,
  mockListAddressBook,
  mockAddAddressBook,
  mockDeleteAddressBook,
  mockCreateMintOrder,
  mockCreateRedeemOrder,
  mockGetRedeemOrder,
  mockReportBurnTx,
  mockListConsumerTransactions,
  mockListBankAccounts,
  mockAddBankAccount,
  mockDeleteBankAccount,
  MOCK_BLACKLISTED_ADDRESS,
} from "@/lib/api/mock-api";

const VALID_REDEEM = {
  amount: "100",
  amountCurrency: "USD" as const,
  chain: "polygon",
  userAddress: "0x000000C528aE908fB929a0898B65e913623c9aFf",
  bankCode: "014",
  bankAccountNumber: "1234563210",
  bankAccountName: "SINGGIH BRILIAN TARA",
};

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

    // USDX-244: union now includes redeem rows (type=REDEEM filter effective).
    test("returns redeem rows with net payout + RedeemStatus + burn fields", async () => {
      const result = await mockListConsumerTransactions({ page: 1, take: 50, type: "REDEEM" });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((t) => t.type === "REDEEM")).toBe(true);
      const row = result.data[0];
      // Redeem rows carry gross + net (not the mint subtotal/totalPay fields).
      expect(row.netPayoutIdr).not.toBeNull();
      expect(row.grossIdr).not.toBeNull();
      expect(row.subtotalIdr).toBeNull();
      expect(row.totalPayIdr).toBeNull();
      expect(row.paymentStatus).toBeNull();
      // A completed redeem exposes its burn tx hash.
      const complete = result.data.find((t) => t.status === "PAYOUT_COMPLETE");
      expect(complete?.txHash).toMatch(/^0x/);
    });

    test("unfiltered union contains both mint and redeem", async () => {
      const result = await mockListConsumerTransactions({ page: 1, take: 50 });
      const types = new Set(result.data.map((t) => t.type));
      expect(types.has("MINT")).toBe(true);
      expect(types.has("REDEEM")).toBe(true);
    });
  });
});

// USDX-259: redeem create binds + pre-checks the burn wallet, and the burn-tx
// report stamps the order optimistically (status stays AWAITING_BURN).
describe("mock redeem create — wallet pre-check (USDX-259)", () => {
  afterEach(() => {
    localStorage.removeItem("usdx-mock-wallet-balance");
  });

  describe("positive", () => {
    test("echoes the bound userAddress on the created order", async () => {
      const order = await mockCreateRedeemOrder(VALID_REDEEM);
      expect(order.userAddress).toBe(VALID_REDEEM.userAddress);
      expect(order.status).toBe("AWAITING_BURN");
    });
  });

  describe("negative", () => {
    test("blacklisted wallet → 422 WALLET_BLACKLISTED", async () => {
      await expect(
        mockCreateRedeemOrder({ ...VALID_REDEEM, userAddress: MOCK_BLACKLISTED_ADDRESS }),
      ).rejects.toMatchObject({ status: 422, code: "WALLET_BLACKLISTED" });
    });

    test("armed balance below amount → 422 INSUFFICIENT_BALANCE", async () => {
      localStorage.setItem("usdx-mock-wallet-balance", "10"); // < 100 USDX
      await expect(mockCreateRedeemOrder(VALID_REDEEM)).rejects.toMatchObject({
        status: 422,
        code: "INSUFFICIENT_BALANCE",
      });
    });
  });
});

// USDX-267: two-path destination. A saved `bankAccountId` resolves the number/name
// from the entry server-side (no plaintext re-sent); manual sends the trio. The
// resolved snapshot must match the picked account — the bug this rework fixes.
describe("mock redeem create — two-path destination (USDX-267)", () => {
  // Seeded saved account (mock-api): id seed_bank_1 = BCA (014) 1234563210.
  const SAVED_REDEEM = {
    amount: "100",
    amountCurrency: "USD" as const,
    chain: "polygon",
    userAddress: "0x000000C528aE908fB929a0898B65e913623c9aFf",
    bankAccountId: "seed_bank_1",
  };

  describe("positive", () => {
    test("saved path resolves the snapshot from the entry (masked + name match)", async () => {
      const order = await mockCreateRedeemOrder(SAVED_REDEEM);
      expect(order.bankCode).toBe("014");
      expect(order.bankAccountNumberMasked).toBe("••••••3210");
      expect(order.bankAccountName).toBe("SINGGIH BRILIAN TARA");
      // The plaintext number is never echoed on the created order.
      expect(JSON.stringify(order)).not.toContain("1234563210");
    });
  });

  describe("negative", () => {
    test("unknown/unowned bankAccountId → 422 INVALID_BANK_ACCOUNT", async () => {
      await expect(
        mockCreateRedeemOrder({ ...SAVED_REDEEM, bankAccountId: "bank_nope" }),
      ).rejects.toMatchObject({ status: 422, code: "INVALID_BANK_ACCOUNT" });
    });

    test("bankAccountId + bankAccountNumber together → 422 VALIDATION_ERROR", async () => {
      await expect(
        mockCreateRedeemOrder({ ...SAVED_REDEEM, bankAccountNumber: "1234563210" }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    test("neither path complete → 422 VALIDATION_ERROR", async () => {
      await expect(
        mockCreateRedeemOrder({
          amount: "100",
          amountCurrency: "USD",
          chain: "polygon",
          userAddress: "0x000000C528aE908fB929a0898B65e913623c9aFf",
          bankCode: "014", // missing number + name, no bankAccountId
        }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });
  });
});

describe("mockReportBurnTx (USDX-259)", () => {
  const TX = "0x" + "ab".repeat(32);

  describe("positive", () => {
    test("stamps burnSubmittedAt + burnTxHash, status stays AWAITING_BURN", async () => {
      const order = await mockCreateRedeemOrder(VALID_REDEEM);
      const after = await mockReportBurnTx(order.id, TX);
      expect(after.status).toBe("AWAITING_BURN");
      expect(after.burnTxHash).toBe(TX);
      expect(after.burnSubmittedAt).not.toBeNull();
      // The GET reflects the same optimistic stamp.
      const fetched = await mockGetRedeemOrder(order.id);
      expect(fetched.burnSubmittedAt).not.toBeNull();
    });

    test("idempotent — re-report keeps the first timestamp", async () => {
      const order = await mockCreateRedeemOrder(VALID_REDEEM);
      const first = await mockReportBurnTx(order.id, TX);
      const second = await mockReportBurnTx(order.id, TX);
      expect(second.burnSubmittedAt).toBe(first.burnSubmittedAt);
    });
  });

  describe("negative", () => {
    test("invalid tx hash → 422 VALIDATION_ERROR", async () => {
      const order = await mockCreateRedeemOrder(VALID_REDEEM);
      await expect(mockReportBurnTx(order.id, "0xnope")).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
    });

    test("unknown order → 404", async () => {
      await expect(mockReportBurnTx("rdm_missing", TX)).rejects.toMatchObject({ status: 404 });
    });
  });
});

// USDX-261: Bank Account Book mock — saved redeem payout accounts. Parity with
// the address-book mock, but the account number comes back masked only.
describe("mock bank account book (USDX-261)", () => {
  const VALID_BANK = {
    bankCode: "014",
    accountNumber: "5566778899",
    accountName: "DEMO HOLDER",
    label: "Tabungan",
  };

  describe("positive", () => {
    test("seeded accounts list back with a masked number (never plaintext)", async () => {
      const list = await mockListBankAccounts();
      expect(list.length).toBeGreaterThan(0);
      for (const e of list) {
        expect(e.accountNumberMasked).toMatch(/^•+\d{4}$/);
        // The plaintext number must never appear on the entry.
        expect(JSON.stringify(e)).not.toContain("1234563210");
      }
    });

    test("adds an entry and lists it back (masked)", async () => {
      const entry = await mockAddBankAccount(VALID_BANK);
      expect(entry.accountNumberMasked).toBe("••••••8899");
      expect(entry.accountName).toBe("DEMO HOLDER");
      expect(entry.label).toBe("Tabungan");
      const list = await mockListBankAccounts();
      expect(list.some((e) => e.id === entry.id)).toBe(true);
      await mockDeleteBankAccount(entry.id); // cleanup (module-scoped state)
    });

    test("empty label is stored as null", async () => {
      const entry = await mockAddBankAccount({ ...VALID_BANK, accountNumber: "5566778800", label: "" });
      expect(entry.label).toBeNull();
      await mockDeleteBankAccount(entry.id);
    });
  });

  describe("negative", () => {
    test("duplicate (bankCode + number) → 409 BANK_ACCOUNT_ALREADY_EXISTS", async () => {
      const entry = await mockAddBankAccount({ ...VALID_BANK, accountNumber: "5566770000" });
      await expect(
        mockAddBankAccount({ ...VALID_BANK, accountNumber: "5566770000" }),
      ).rejects.toMatchObject({ status: 409, code: "BANK_ACCOUNT_ALREADY_EXISTS" });
      await mockDeleteBankAccount(entry.id);
    });

    test("account number with non-digits → 422 VALIDATION_ERROR", async () => {
      await expect(
        mockAddBankAccount({ ...VALID_BANK, accountNumber: "12ab" }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    test("label over 50 chars → 422 VALIDATION_ERROR", async () => {
      await expect(
        mockAddBankAccount({ ...VALID_BANK, accountNumber: "5566771111", label: "x".repeat(51) }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    test("delete of an unknown id throws 404", async () => {
      await expect(mockDeleteBankAccount("bank_missing")).rejects.toMatchObject({ status: 404 });
    });
  });
});

// USDX-252: the throughput-throttle seam (localStorage "usdx-mock-ratelimit")
// makes mint/redeem create + status poll return 429 RATE_LIMITED so the central
// toast + poll backoff are exercisable offline.
describe("429 RATE_LIMITED seam", () => {
  afterEach(() => {
    localStorage.removeItem("usdx-mock-ratelimit");
  });

  describe("positive", () => {
    test("armed seam → redeem create throws 429 RATE_LIMITED with Retry-After", async () => {
      localStorage.setItem("usdx-mock-ratelimit", "3");
      await expect(mockCreateRedeemOrder(VALID_REDEEM)).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
        retryAfterSeconds: 3,
      });
    });
  });

  describe("negative", () => {
    test("unarmed → create proceeds normally", async () => {
      const order = await mockCreateRedeemOrder(VALID_REDEEM);
      expect(order.status).toBe("AWAITING_BURN");
    });
  });
});
