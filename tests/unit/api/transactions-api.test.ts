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
  });

  describe("edge cases", () => {
    test("defaults metadata from the data length when the envelope omits it", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: [{ id: "tx1" }, { id: "tx2" }] }));

      const result = await listTransactions();
      expect(result.metadata).toEqual({ page: 1, limit: 2, total: 2 });
    });
  });
});
