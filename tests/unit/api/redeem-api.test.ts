import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so the redeem client hits apiFetch, not the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import { createRedeemOrder, getRedeemOrder } from "@/lib/api/redeem-api";
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

const createReq = {
  amount: "100",
  amountCurrency: "USD" as const,
  chain: "polygon",
  bankCode: "014",
  bankAccountNumber: "1234563210",
  bankAccountName: "SINGGIH BRILIAN TARA",
};

describe("createRedeemOrder", () => {
  describe("positive", () => {
    test("POSTs /api/v2/redeem with the bearer token + body and unwraps the envelope", async () => {
      const order = { id: "rdm_1", redeemId: "0xabc", amountWei: "100000000", status: "AWAITING_BURN" };
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { status: "success", data: order }));

      await expect(createRedeemOrder(createReq)).resolves.toEqual(order);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/redeem");
      expect(init.method).toBe("POST");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
      expect(JSON.parse(init.body)).toMatchObject({ chain: "polygon", bankCode: "014" });
    });
  });

  describe("negative", () => {
    test("propagates 422 INVALID_BANK_ACCOUNT", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(422, {
          status: "error",
          error: { code: "INVALID_BANK_ACCOUNT", message: "Rekening tidak valid" },
        }),
      );
      await expect(createRedeemOrder(createReq)).rejects.toMatchObject({
        status: 422,
        code: "INVALID_BANK_ACCOUNT",
      });
    });
  });
});

describe("getRedeemOrder", () => {
  describe("positive", () => {
    test("GETs /api/v2/redeem/{id}", async () => {
      const detail = { id: "rdm_1", status: "PROCESSING_PAYOUT", burnTxHash: "0xfeed" };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: detail }));

      await expect(getRedeemOrder("rdm_1")).resolves.toEqual(detail);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/redeem/rdm_1");
      expect(init.method).toBe("GET");
    });
  });

  describe("negative", () => {
    test("propagates 404 for another user's order", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { status: "error", error: { code: "NOT_FOUND", message: "nope" } }),
      );
      await expect(getRedeemOrder("rdm_x")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    });
  });
});
