import { describe, test, expect, beforeEach } from "vitest";
import { mockGetMe, MOCK_BLACKLISTED_ADDRESS } from "@/lib/api/mock-api";
import {
  mockGetCustodialWallet,
  mockTransferCustodial,
  seedMockCustodialWallet,
  resetMockCustodialWallet,
  MOCK_CUSTODIAL_ADDRESS,
  MOCK_PIN,
} from "@/lib/api/mock-custodial-wallet";

// Mock layer for the custodial wallet (wallet.yaml, USDX-567): GET /api/v2/wallet
// + POST /api/v2/wallet/transfer with the contract's idempotency semantics. The
// mock is the only backend the offline suites (Playwright) ever see, so its
// error precedence has to match the contract — a UI branch that only exists
// against the real backend is a branch nobody has tested.
const TO = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const KEY = "0193abcd-2c4d-7abc-91ff-9a7fcd0d2bf1";
const KEY_2 = "0193abcd-2c4d-7abc-91ff-9a7fcd0d2bf2";

beforeEach(() => {
  resetMockCustodialWallet();
});

describe("mockGetCustodialWallet", () => {
  describe("positive", () => {
    test("returns the seeded wallet with a readable balance", async () => {
      seedMockCustodialWallet({ balance: "125.50" });
      const wallet = await mockGetCustodialWallet();
      expect(wallet.address).toBe(MOCK_CUSTODIAL_ADDRESS);
      expect(wallet.status).toBe("ACTIVE");
      expect(wallet.balance).toBe("125.50");
      expect(wallet.balanceWei).toBe("125500000");
      expect(wallet.balanceAt).not.toBeNull();
    });

    test("/auth/me carries the custodialWallet summary + pinSet", async () => {
      seedMockCustodialWallet();
      const me = await mockGetMe();
      expect(me.custodialWallet).toEqual({ address: MOCK_CUSTODIAL_ADDRESS, status: "ACTIVE" });
      expect(me.pinSet).toBe(true);
    });
  });

  describe("negative", () => {
    test("404 WALLET_NOT_FOUND when the user has no custodial wallet", async () => {
      await expect(mockGetCustodialWallet()).rejects.toMatchObject({
        status: 404,
        code: "WALLET_NOT_FOUND",
      });
      const me = await mockGetMe();
      expect(me.custodialWallet).toBeNull();
    });
  });

  describe("edge case", () => {
    test("balance null is reported as null (unreadable), never 0", async () => {
      seedMockCustodialWallet({ balance: null });
      const wallet = await mockGetCustodialWallet();
      expect(wallet.balance).toBeNull();
      expect(wallet.balanceWei).toBeNull();
      expect(wallet.balanceAt).toBeNull();
    });

    test("PROVISIONING has no address and no balance", async () => {
      seedMockCustodialWallet({ status: "PROVISIONING", address: null, balance: "10.00" });
      const wallet = await mockGetCustodialWallet();
      expect(wallet.address).toBeNull();
      expect(wallet.balance).toBeNull();
    });
  });
});

describe("mockTransferCustodial", () => {
  const req = { to: TO, amount: "25", pin: MOCK_PIN };

  describe("positive", () => {
    test("broadcasts and debits the balance", async () => {
      seedMockCustodialWallet({ balance: "100.00" });
      const accepted = await mockTransferCustodial(req, KEY);
      expect(accepted.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(accepted.from).toBe(MOCK_CUSTODIAL_ADDRESS);
      expect(accepted.to).toBe(TO);
      expect(accepted.amount).toBe("25.00");
      expect(accepted.amountWei).toBe("25000000");
      const wallet = await mockGetCustodialWallet();
      expect(wallet.balance).toBe("75.00");
    });

    test("replay: same key + same body → identical result, no second debit", async () => {
      seedMockCustodialWallet({ balance: "100.00" });
      const first = await mockTransferCustodial(req, KEY);
      const second = await mockTransferCustodial(req, KEY);
      expect(second).toEqual(first);
      expect((await mockGetCustodialWallet()).balance).toBe("75.00");
    });

    test("replay is resolved before the balance pre-check", async () => {
      // The first transfer left 5 USDX; a retry of a 25-USDX transfer must
      // replay, not fail INSUFFICIENT_BALANCE (custodial-wallet.md §5.1).
      seedMockCustodialWallet({ balance: "30.00" });
      const first = await mockTransferCustodial(req, KEY);
      await expect(mockTransferCustodial(req, KEY)).resolves.toEqual(first);
    });

    test("a new key with the same body is a second transfer", async () => {
      seedMockCustodialWallet({ balance: "100.00" });
      const a = await mockTransferCustodial(req, KEY);
      const b = await mockTransferCustodial(req, KEY_2);
      expect(b.txHash).not.toBe(a.txHash);
      expect((await mockGetCustodialWallet()).balance).toBe("50.00");
    });
  });

  describe("negative", () => {
    test("wrong PIN → 401 INVALID_PIN; five wrong → 429 TOO_MANY_ATTEMPTS", async () => {
      seedMockCustodialWallet();
      for (let i = 0; i < 5; i++) {
        await expect(mockTransferCustodial({ ...req, pin: "000000" }, KEY)).rejects.toMatchObject({
          status: 401,
          code: "INVALID_PIN",
        });
      }
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        status: 429,
        code: "TOO_MANY_ATTEMPTS",
        retryAfterSeconds: 900,
      });
    });

    test("PIN not set → 401 PIN_NOT_SET", async () => {
      seedMockCustodialWallet({ pinSet: false });
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        status: 401,
        code: "PIN_NOT_SET",
      });
    });

    test("PROVISIONING / SUSPENDED wallet → 409 WALLET_NOT_ACTIVE", async () => {
      seedMockCustodialWallet({ status: "SUSPENDED" });
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        status: 409,
        code: "WALLET_NOT_ACTIVE",
      });
    });

    test("same key + different body → 409 IDEMPOTENCY_KEY_REUSED", async () => {
      seedMockCustodialWallet();
      await mockTransferCustodial(req, KEY);
      await expect(mockTransferCustodial({ ...req, amount: "26" }, KEY)).rejects.toMatchObject({
        status: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
      });
    });

    test("blacklisted recipient → 422 RECIPIENT_BLACKLISTED", async () => {
      seedMockCustodialWallet();
      await expect(
        mockTransferCustodial({ ...req, to: MOCK_BLACKLISTED_ADDRESS }, KEY),
      ).rejects.toMatchObject({ status: 422, code: "RECIPIENT_BLACKLISTED" });
    });

    test("balance below amount → 422 INSUFFICIENT_BALANCE", async () => {
      seedMockCustodialWallet({ balance: "10.00" });
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        status: 422,
        code: "INSUFFICIENT_BALANCE",
      });
    });

    test("own custodial address as destination → 422 VALIDATION_ERROR", async () => {
      seedMockCustodialWallet();
      await expect(
        mockTransferCustodial({ ...req, to: MOCK_CUSTODIAL_ADDRESS.toLowerCase() }, KEY),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    test("malformed Idempotency-Key → 422 without burning a PIN attempt", async () => {
      seedMockCustodialWallet();
      await expect(mockTransferCustodial({ ...req, pin: "000000" }, "not-a-uuid")).rejects.toMatchObject(
        { status: 422, code: "VALIDATION_ERROR" },
      );
      // The wrong PIN above was never checked, so the correct one still works.
      await expect(mockTransferCustodial(req, KEY)).resolves.toMatchObject({ to: TO });
    });

    test("no wallet at all → 404 WALLET_NOT_FOUND", async () => {
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        status: 404,
        code: "WALLET_NOT_FOUND",
      });
    });

    test("wallet-service down → 503 WALLET_SERVICE_UNAVAILABLE, nothing debited", async () => {
      seedMockCustodialWallet({ balance: "100.00", serviceDown: true });
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        status: 503,
        code: "WALLET_SERVICE_UNAVAILABLE",
      });
      expect((await mockGetCustodialWallet()).balance).toBe("100.00");
    });

    test("limit seam → 422 TRANSFER_LIMIT_EXCEEDED with details", async () => {
      seedMockCustodialWallet({ transferLimit: { perTx: "10.00" } });
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        status: 422,
        code: "TRANSFER_LIMIT_EXCEEDED",
        details: { limitType: "PER_TX", limit: "10.00", resetAt: null },
      });
    });
  });

  describe("edge case", () => {
    test("slowFirstTransfer: first call is IN_PROGRESS, a same-key retry later settles", async () => {
      seedMockCustodialWallet({ balance: "100.00", slowFirstTransfer: true });
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        status: 409,
        code: "IDEMPOTENCY_KEY_IN_PROGRESS",
      });
      // Still in flight right away.
      await expect(mockTransferCustodial(req, KEY)).rejects.toMatchObject({
        code: "IDEMPOTENCY_KEY_IN_PROGRESS",
      });
      await new Promise((r) => setTimeout(r, 1_600));
      const accepted = await mockTransferCustodial(req, KEY);
      expect(accepted.to).toBe(TO);
      expect((await mockGetCustodialWallet()).balance).toBe("75.00");
    }, 10_000);

    test("unreadable balance (null) does not block the transfer — the contract is the backstop", async () => {
      seedMockCustodialWallet({ balance: null });
      await expect(mockTransferCustodial(req, KEY)).resolves.toMatchObject({ amount: "25.00" });
    });
  });
});
