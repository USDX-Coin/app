import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so both calls hit apiFetch instead of the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import { getCustodialWallet, transferCustodial } from "@/lib/api/wallet-api";
import { configureApiClient } from "@/lib/api/client";
import type { CustodialWallet, TransferAccepted } from "@/types";

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
const onUnauthorized = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  onUnauthorized.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  configureApiClient({ getToken: () => "session-token", onUnauthorized });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const WALLET: CustodialWallet = {
  address: "0x000000C528aE908fB929a0898B65e913623c9aFf",
  status: "ACTIVE",
  chain: "polygon",
  contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
  balance: "125.50",
  balanceWei: "125500000",
  balanceAt: "2026-08-28T04:12:31.000Z",
  createdAt: "2026-08-28T04:10:00.000Z",
};

describe("getCustodialWallet", () => {
  describe("positive", () => {
    test("GETs /api/v2/wallet with the bearer and unwraps the envelope", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: WALLET }));
      await expect(getCustodialWallet()).resolves.toEqual(WALLET);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/wallet");
      expect(init.method).toBe("GET");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
    });
  });

  describe("negative", () => {
    test("404 WALLET_NOT_FOUND is the normal 'no wallet' answer → null, not a throw", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { status: "error", error: { code: "WALLET_NOT_FOUND", message: "x" } }),
      );
      await expect(getCustodialWallet()).resolves.toBeNull();
    });

    test("other errors still propagate", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, { status: "error", error: { code: "EMAIL_NOT_VERIFIED", message: "x" } }),
      );
      await expect(getCustodialWallet()).rejects.toMatchObject({ status: 403, code: "EMAIL_NOT_VERIFIED" });
    });
  });

  describe("edge cases", () => {
    test("a plain 404 NOT_FOUND (not WALLET_NOT_FOUND) is not swallowed", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { status: "error", error: { code: "NOT_FOUND", message: "x" } }),
      );
      await expect(getCustodialWallet()).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    });
  });
});

describe("transferCustodial", () => {
  const req = { to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", amount: "25.00", pin: "123456" };
  const KEY = "0193abcd-2c4d-7abc-91ff-9a7fcd0d2bf1";
  const ACCEPTED: TransferAccepted = {
    txHash: "0x" + "ab".repeat(32),
    from: WALLET.address!,
    to: req.to,
    amount: "25.00",
    amountWei: "25000000",
    chain: "polygon",
    submittedAt: "2026-08-28T04:20:11.000Z",
  };

  describe("positive", () => {
    test("POSTs /api/v2/wallet/transfer with the Idempotency-Key header and the body", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(202, { status: "success", data: ACCEPTED }));
      await expect(transferCustodial(req, KEY)).resolves.toEqual(ACCEPTED);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/wallet/transfer");
      expect(init.method).toBe("POST");
      const headers = init.headers as Headers;
      expect(headers.get("Idempotency-Key")).toBe(KEY);
      expect(headers.get("Authorization")).toBe("Bearer session-token");
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(JSON.parse(init.body)).toEqual(req);
    });

    test("a 200 replay unwraps to the same shape as a 202", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: ACCEPTED }));
      await expect(transferCustodial(req, KEY)).resolves.toEqual(ACCEPTED);
    });
  });

  describe("negative", () => {
    test("401 INVALID_PIN is an inline error — the global logout handler is NOT fired", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { status: "error", error: { code: "INVALID_PIN", message: "PIN salah" } }),
      );
      await expect(transferCustodial(req, KEY)).rejects.toMatchObject({ status: 401, code: "INVALID_PIN" });
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    test("propagates 409 WALLET_NOT_ACTIVE", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, { status: "error", error: { code: "WALLET_NOT_ACTIVE", message: "x" } }),
      );
      await expect(transferCustodial(req, KEY)).rejects.toMatchObject({ status: 409, code: "WALLET_NOT_ACTIVE" });
    });

    test("propagates 422 TRANSFER_LIMIT_EXCEEDED with its details", async () => {
      const details = { limitType: "DAILY", limit: "5000.00", remaining: "120.00", resetAt: "2026-08-29T00:00:00.000Z" };
      fetchMock.mockResolvedValueOnce(
        jsonResponse(422, {
          status: "error",
          error: { code: "TRANSFER_LIMIT_EXCEEDED", message: "x", details },
        }),
      );
      await expect(transferCustodial(req, KEY)).rejects.toMatchObject({ status: 422, details });
    });
  });

  describe("edge cases", () => {
    test("429 TOO_MANY_ATTEMPTS carries Retry-After from the header", async () => {
      const res = jsonResponse(429, {
        status: "error",
        error: { code: "TOO_MANY_ATTEMPTS", message: "x", details: { retryAfterSeconds: 900 } },
      });
      (res.headers as Headers).set("Retry-After", "900");
      fetchMock.mockResolvedValueOnce(res);
      await expect(transferCustodial(req, KEY)).rejects.toMatchObject({
        status: 429,
        code: "TOO_MANY_ATTEMPTS",
        retryAfterSeconds: 900,
      });
    });
  });
});
