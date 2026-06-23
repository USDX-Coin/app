import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so the redeem client hits apiFetch, not the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import { createRedeemOrder, getRedeemOrder, reportBurnTx } from "@/lib/api/redeem-api";
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
  userAddress: "0x000000C528aE908fB929a0898B65e913623c9aFf",
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
      // userAddress (the connected burn wallet) is sent at create (USDX-259).
      expect(JSON.parse(init.body)).toMatchObject({
        chain: "polygon",
        bankCode: "014",
        userAddress: "0x000000C528aE908fB929a0898B65e913623c9aFf",
      });
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

describe("reportBurnTx", () => {
  const txHash = "0x" + "ab".repeat(32);

  describe("positive", () => {
    test("POSTs /api/v2/redeem/{id}/burn-tx with the tx hash", async () => {
      const detail = { id: "rdm_1", status: "AWAITING_BURN", burnTxHash: txHash };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: detail }));

      await expect(reportBurnTx("rdm_1", { txHash })).resolves.toEqual(detail);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/redeem/rdm_1/burn-tx");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ txHash });
    });
  });

  describe("negative", () => {
    test("propagates 409 INVALID_ORDER_STATE", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, {
          status: "error",
          error: { code: "INVALID_ORDER_STATE", message: "bukan menunggu burn" },
        }),
      );
      await expect(reportBurnTx("rdm_1", { txHash })).rejects.toMatchObject({
        status: 409,
        code: "INVALID_ORDER_STATE",
      });
    });
  });
});
