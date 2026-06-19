import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so the module hits apiFetch, not the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import { createMintOrder } from "@/lib/api/mint-api";
import { configureApiClient } from "@/lib/api/client";
import type { CreateMintOrderRequest } from "@/lib/api/types";

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
  configureApiClient({ getToken: () => "session-token", onUnauthorized: () => {}, onForbidden: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createMintOrder", () => {
  const body: CreateMintOrderRequest = {
    userAddress: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    amount: "100",
    amountCurrency: "USD",
    chain: "polygon",
  };

  describe("positive", () => {
    test("POSTs /api/v2/mint with the body and returns the created order", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { status: "success", data: { id: "mint_1" } }));

      await expect(createMintOrder(body)).resolves.toEqual({ id: "mint_1" });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/mint");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual(body);
    });
  });

  describe("negative", () => {
    test("propagates 503 MINT_DISABLED (production gate)", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(503, { status: "error", error: { code: "MINT_DISABLED", message: "off" } }),
      );
      await expect(createMintOrder(body)).rejects.toMatchObject({ status: 503, code: "MINT_DISABLED" });
    });

    test("propagates 422 RECIPIENT_BLACKLISTED", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(422, { status: "error", error: { code: "RECIPIENT_BLACKLISTED", message: "no" } }),
      );
      await expect(createMintOrder(body)).rejects.toMatchObject({
        status: 422,
        code: "RECIPIENT_BLACKLISTED",
      });
    });
  });
});

// payMintOrder + getMintOrder dipindah ke repo `checkout` (USDX-225); app hanya CREATE.
