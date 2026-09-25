import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so the module hits apiFetchPaginated, not the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import { listTransactions } from "@/lib/api/transactions-api";
import { configureApiClient } from "@/lib/api/client";

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    headers: new Headers(),
    json: async () => payload,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  configureApiClient({ getToken: () => "session-token", onUnauthorized: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listTransactions", () => {
  describe("positive", () => {
    test("returns data + pagination metadata from the paginated envelope", async () => {
      const items = [{ id: "tx1", type: "MINT" }];
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: { page: 1, limit: 10, total: 1 }, data: items }),
      );

      const result = await listTransactions();
      expect(result.data).toEqual(items);
      expect(result.metadata).toEqual({ page: 1, limit: 10, total: 1 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/transactions");
      expect(init.method).toBe("GET");
    });

    test("serializes page/take/type into the query string", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: { page: 2, limit: 20, total: 0 }, data: [] }),
      );

      await listTransactions({ page: 2, take: 20, type: "MINT" });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/transactions?page=2&take=20&type=MINT");
    });

    // Riwayat terpadu (USDX-713, transactions.yaml § list): tab "Semua" meminta transfer ikut.
    test("sends includeTransfers=true when asked for every kind", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: { page: 1, limit: 10, total: 0 }, data: [] }),
      );

      await listTransactions({ page: 1, take: 10, includeTransfers: true });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/transactions?page=1&take=10&includeTransfers=true");
    });

    test("serializes the transfer types", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { status: "success", metadata: { page: 1, limit: 10, total: 0 }, data: [] }),
      );

      await listTransactions({ type: "TRANSFER_IN" });
      await listTransactions({ type: "TRANSFER_OUT" });
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/transactions?type=TRANSFER_IN");
      expect(fetchMock.mock.calls[1][0]).toBe("/api/v2/transactions?type=TRANSFER_OUT");
    });

    test("keeps mint, redeem and transfer rows", async () => {
      const items = [
        { id: "a", type: "MINT" },
        { id: "b", type: "REDEEM" },
        { id: "c", type: "TRANSFER_IN" },
        { id: "d", type: "TRANSFER_OUT" },
      ];
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: { page: 1, limit: 10, total: 4 }, data: items }),
      );

      const result = await listTransactions({ includeTransfers: true });
      expect(result.data.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("negative", () => {
    // common.yaml § HistoryItemType: "Enum ini bisa bertambah: klien wajib punya cabang
    // default (abaikan/sembunyikan baris jenis tak dikenal, jangan crash)".
    test("drops rows of a type the app does not know yet", async () => {
      const items = [
        { id: "a", type: "MINT" },
        { id: "x", type: "BRIDGE_IN" },
        { id: "y" },
        { id: "d", type: "TRANSFER_OUT" },
      ];
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: { page: 1, limit: 10, total: 4 }, data: items }),
      );

      const result = await listTransactions({ includeTransfers: true });
      expect(result.data.map((r) => r.id)).toEqual(["a", "d"]);
      // Paginasi tetap milik server.
      expect(result.metadata.total).toBe(4);
    });
  });

  describe("edge case", () => {
    test("a type filter wins: includeTransfers is not sent alongside it", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: { page: 1, limit: 10, total: 0 }, data: [] }),
      );

      await listTransactions({ type: "REDEEM", includeTransfers: true });
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/transactions?type=REDEEM");
    });

    test("includeTransfers=false is the old behaviour: nothing extra in the query", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: { page: 1, limit: 10, total: 0 }, data: [] }),
      );

      await listTransactions({ includeTransfers: false });
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/transactions");
    });

    test("defaults metadata from the data length when the envelope omits it", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: [{ id: "tx1" }, { id: "tx2" }] }));

      const result = await listTransactions();
      expect(result.metadata).toEqual({ page: 1, limit: 2, total: 2 });
    });
  });
});
