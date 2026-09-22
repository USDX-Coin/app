import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mockGetWalletTransfer,
  mockListWalletTransfers,
  mockTransferCustodial,
  resetMockCustodialWallet,
  seedMockCustodialWallet,
} from "@/lib/api/mock-custodial-wallet";
import { MOCK_TRANSFER_CONFIRM_MS, seedMockWalletTransfers } from "@/lib/api/mock-wallet-transfers";
import { MOCK_WALLET_TRANSFER_FIXTURES as FX } from "@/lib/api/mock-wallet-transfer-fixtures";
import { MOCK_PIN } from "@/lib/api/mock-pin";

// Mock riwayat & status transfer custodial (wallet.yaml § transfers / transfer-detail,
// USDX-701). Satu-satunya backend yang dilihat suite Playwright offline, jadi urutan,
// pagination, 404 dan perpindahan status harus sama dengan kontrak.
const TO = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const KEY = "0193abcd-2c4d-7abc-91ff-9a7fcd0d2bf1";
const KEY_2 = "0193abcd-2c4d-7abc-91ff-9a7fcd0d2bf2";
const UNKNOWN_ID = "0193abce-11aa-7bcd-8e01-5c2f0a9d4eff";

beforeEach(() => {
  resetMockCustodialWallet();
  localStorage.removeItem("usdx-mock-ratelimit");
});

afterEach(() => {
  vi.useRealTimers();
});

function send(key = KEY, amount = "25") {
  return mockTransferCustodial({ to: TO, amount, pin: MOCK_PIN }, key);
}

describe("mockListWalletTransfers", () => {
  describe("positive", () => {
    test("returns the account's transfers newest first with the pagination envelope", async () => {
      seedMockWalletTransfers([FX.dropped, FX.confirmed, FX.pending, FX.reverted]);
      const page = await mockListWalletTransfers({});
      expect(page.data.map((t) => t.id)).toEqual([
        FX.pending.id,
        FX.confirmed.id,
        FX.reverted.id,
        FX.dropped.id,
      ]);
      expect(page.metadata).toEqual({ page: 1, limit: 10, total: 4 });
    });

    test("paginates with page/take", async () => {
      seedMockWalletTransfers([FX.dropped, FX.confirmed, FX.pending, FX.reverted]);
      const second = await mockListWalletTransfers({ page: 2, take: 3 });
      expect(second.data.map((t) => t.id)).toEqual([FX.dropped.id]);
      expect(second.metadata).toEqual({ page: 2, limit: 3, total: 4 });
    });

    test("a broadcast transfer appears with the SAME id the 202 returned, as PENDING", async () => {
      seedMockCustodialWallet();
      const accepted = await send();
      const page = await mockListWalletTransfers({});
      expect(page.data).toHaveLength(1);
      expect(page.data[0]).toMatchObject({
        id: accepted.id,
        txHash: accepted.txHash,
        status: "PENDING",
        failureReason: null,
        blockNumber: null,
        finalizedAt: null,
      });
    });

    test("wire items carry only contract fields (no mock bookkeeping)", async () => {
      seedMockWalletTransfers([FX.confirmed]);
      const [item] = (await mockListWalletTransfers({})).data;
      expect(Object.keys(item).sort()).toEqual(
        [
          "amount",
          "amountWei",
          "blockNumber",
          "chain",
          "failureReason",
          "finalizedAt",
          "from",
          "id",
          "status",
          "submittedAt",
          "to",
          "txHash",
        ].sort(),
      );
    });
  });

  describe("negative", () => {
    test("take outside 1..50 → 422 VALIDATION_ERROR", async () => {
      await expect(mockListWalletTransfers({ take: 51 })).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
      await expect(mockListWalletTransfers({ page: 0 })).rejects.toMatchObject({ status: 422 });
    });

    test("throttle seam → 429 RATE_LIMITED with Retry-After", async () => {
      localStorage.setItem("usdx-mock-ratelimit", "2");
      await expect(mockListWalletTransfers({})).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
        retryAfterSeconds: 2,
      });
    });

    test("another user's transfers are not listed", async () => {
      seedMockWalletTransfers([FX.confirmed], "usr_other");
      const page = await mockListWalletTransfers({});
      expect(page.data).toEqual([]);
      expect(page.metadata.total).toBe(0);
    });
  });

  describe("edge case", () => {
    test("a user without a wallet gets 200 with an empty list, not 404", async () => {
      const page = await mockListWalletTransfers({});
      expect(page).toEqual({ data: [], metadata: { page: 1, limit: 10, total: 0 } });
    });

    test("an idempotent replay does not add a second row", async () => {
      seedMockCustodialWallet();
      const first = await send();
      const replay = await send();
      expect(replay.id).toBe(first.id);
      expect((await mockListWalletTransfers({})).data).toHaveLength(1);
    });
  });
});

describe("mockGetWalletTransfer", () => {
  describe("positive", () => {
    test("returns each fixture as seeded — three statuses, two failure reasons", async () => {
      seedMockWalletTransfers([FX.pending, FX.confirmed, FX.reverted, FX.dropped]);
      for (const fx of [FX.pending, FX.confirmed, FX.reverted, FX.dropped]) {
        await expect(mockGetWalletTransfer(fx.id)).resolves.toEqual(fx);
      }
    });

    test("a new transfer moves PENDING → CONFIRMED once the watcher decides", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seedMockCustodialWallet();
      const accepted = await send();
      expect((await mockGetWalletTransfer(accepted.id)).status).toBe("PENDING");
      vi.advanceTimersByTime(MOCK_TRANSFER_CONFIRM_MS + 1);
      const settled = await mockGetWalletTransfer(accepted.id);
      expect(settled.status).toBe("CONFIRMED");
      expect(settled.blockNumber).not.toBeNull();
      expect(settled.finalizedAt).not.toBeNull();
    });

    test("seam transferOutcome REVERTED / DROPPED → FAILED with that reason", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seedMockCustodialWallet({ transferOutcome: "REVERTED" });
      const reverted = await send(KEY, "1");
      seedMockCustodialWallet({ transferOutcome: "DROPPED" });
      const dropped = await send(KEY_2, "2");
      vi.advanceTimersByTime(MOCK_TRANSFER_CONFIRM_MS + 1);
      expect(await mockGetWalletTransfer(reverted.id)).toMatchObject({
        status: "FAILED",
        failureReason: "REVERTED",
      });
      expect(await mockGetWalletTransfer(dropped.id)).toMatchObject({
        status: "FAILED",
        failureReason: "DROPPED",
        blockNumber: null,
      });
    });
  });

  describe("negative", () => {
    test("unknown id → 404 WALLET_TRANSFER_NOT_FOUND", async () => {
      await expect(mockGetWalletTransfer(UNKNOWN_ID)).rejects.toMatchObject({
        status: 404,
        code: "WALLET_TRANSFER_NOT_FOUND",
      });
    });

    test("another user's transfer is answered exactly like a missing one", async () => {
      seedMockWalletTransfers([FX.confirmed], "usr_other");
      await expect(mockGetWalletTransfer(FX.confirmed.id)).rejects.toMatchObject({
        status: 404,
        code: "WALLET_TRANSFER_NOT_FOUND",
      });
    });

    test("an id that is not a UUID → 422 VALIDATION_ERROR", async () => {
      await expect(mockGetWalletTransfer("not-a-uuid")).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("edge case", () => {
    test("seam PENDING = stuck forever — age never turns it into FAILED", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seedMockCustodialWallet({ transferOutcome: "PENDING" });
      const accepted = await send();
      vi.advanceTimersByTime(24 * 60 * 60 * 1_000);
      expect(await mockGetWalletTransfer(accepted.id)).toMatchObject({
        status: "PENDING",
        failureReason: null,
        finalizedAt: null,
      });
    });

    test("seam with an unknown outcome surfaces a status value the FE does not know", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seedMockCustodialWallet({ transferOutcome: "SETTLING" });
      const accepted = await send();
      vi.advanceTimersByTime(MOCK_TRANSFER_CONFIRM_MS + 1);
      expect((await mockGetWalletTransfer(accepted.id)).status).toBe("SETTLING");
    });
  });
});
