import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so both calls hit apiFetch instead of the mock.
vi.mock("@/lib/env", () => ({
  env: { apiBaseUrl: "", useMock: false },
}));

import {
  createCustodialWallet,
  getCustodialWallet,
  getWalletTransfer,
  listWalletTransfers,
  transferCustodial,
} from "@/lib/api/wallet-api";
import { configureApiClient } from "@/lib/api/client";
import type { CustodialWallet, TransferAccepted, WalletTransfer } from "@/types";

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    headers: new Headers(),
    json: async () => payload,
  } as unknown as Response;
}

const ACTIVE: CustodialWallet = {
  address: "0x000000C528aE908fB929a0898B65e913623c9aFf",
  status: "ACTIVE",
  chain: "polygon",
  contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
  balance: "125.50",
  balanceWei: "125500000",
  balanceAt: "2026-08-28T04:12:31.000Z",
  createdAt: "2026-08-28T04:10:00.000Z",
};

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

// GET /api/v2/wallet (wallet.yaml) — address + status dari salinan kerja backend,
// saldo live dari chain.
describe("getCustodialWallet", () => {
  describe("positive", () => {
    test("GETs /api/v2/wallet with the bearer token and unwraps the envelope", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: null, data: ACTIVE }),
      );

      await expect(getCustodialWallet()).resolves.toEqual(ACTIVE);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/wallet");
      expect(init.method).toBe("GET");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
    });

    test("keeps a null balance as null — never coerces it to zero", async () => {
      // RPC unreachable: the three balance fields are null and the wallet is
      // still returned (wallet.yaml § GET, "null ≠ nol").
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          status: "success",
          data: { ...ACTIVE, balance: null, balanceWei: null, balanceAt: null },
        }),
      );

      const wallet = await getCustodialWallet();
      expect(wallet?.status).toBe("ACTIVE");
      expect(wallet?.balance).toBeNull();
      expect(wallet?.balanceWei).toBeNull();
      expect(wallet?.balanceAt).toBeNull();
    });
  });

  describe("negative", () => {
    test("404 WALLET_NOT_FOUND resolves to null instead of throwing (normal state)", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, {
          status: "error",
          error: { code: "WALLET_NOT_FOUND", message: "Kamu belum punya wallet custodial" },
        }),
      );

      await expect(getCustodialWallet()).resolves.toBeNull();
    });

    test("other errors are rethrown as ApiError", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(429, {
          status: "error",
          error: { code: "RATE_LIMITED", message: "Terlalu banyak request" },
        }),
      );

      await expect(getCustodialWallet()).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
      });
    });
  });

  describe("edge case", () => {
    test("a 404 with a different code is NOT swallowed — only WALLET_NOT_FOUND is normal", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, {
          status: "error",
          error: { code: "NOT_FOUND", message: "Route not found" },
        }),
      );

      await expect(getCustodialWallet()).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    });

    test("a network failure surfaces as the fetch TypeError, not as null", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(getCustodialWallet()).rejects.toBeInstanceOf(TypeError);
    });
  });
});

// POST /api/v2/wallet — selalu 202 PROVISIONING; 409 dan 503 diteruskan ke pemanggil.
describe("createCustodialWallet", () => {
  describe("positive", () => {
    test("POSTs /api/v2/wallet and returns the PROVISIONING wallet (address null)", async () => {
      const provisioning: CustodialWallet = {
        ...ACTIVE,
        address: null,
        status: "PROVISIONING",
        balance: null,
        balanceWei: null,
        balanceAt: null,
      };
      fetchMock.mockResolvedValueOnce(
        jsonResponse(202, { status: "success", metadata: null, data: provisioning }),
      );

      await expect(createCustodialWallet()).resolves.toEqual(provisioning);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/wallet");
      expect(init.method).toBe("POST");
      expect(init.body).toBeUndefined();
    });
  });

  describe("negative", () => {
    test("409 WALLET_ALREADY_EXISTS is thrown with its code so the hook can fall back to GET", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, {
          status: "error",
          error: { code: "WALLET_ALREADY_EXISTS", message: "Kamu sudah punya wallet custodial" },
        }),
      );

      await expect(createCustodialWallet()).rejects.toMatchObject({
        status: 409,
        code: "WALLET_ALREADY_EXISTS",
      });
    });

    test("503 WALLET_SERVICE_UNAVAILABLE is thrown (safe to retry — nothing changed)", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(503, {
          status: "error",
          error: { code: "WALLET_SERVICE_UNAVAILABLE", message: "Layanan wallet sedang tidak tersedia" },
        }),
      );

      await expect(createCustodialWallet()).rejects.toMatchObject({
        status: 503,
        code: "WALLET_SERVICE_UNAVAILABLE",
      });
    });
  });

  describe("edge case", () => {
    test("a 401 still fires the global unauthorized handler (session gone)", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, {
          status: "error",
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        }),
      );

      await expect(createCustodialWallet()).rejects.toMatchObject({ status: 401 });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });
  });
});

// POST /api/v2/wallet/transfer (USDX-567, wallet.yaml § transfer).
describe("transferCustodial", () => {
  const req = { to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", amount: "25.00", pin: "123456" };
  const KEY = "0193abcd-2c4d-7abc-91ff-9a7fcd0d2bf1";
  const ACCEPTED: TransferAccepted = {
    id: "0193abce-11aa-7bcd-8e01-5c2f0a9d4e77",
    txHash: "0x" + "ab".repeat(32),
    from: ACTIVE.address!,
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

    test("propagates 409 WALLET_NOT_ACTIVE and 422 TRANSFER_LIMIT_EXCEEDED with details", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, { status: "error", error: { code: "WALLET_NOT_ACTIVE", message: "x" } }),
      );
      await expect(transferCustodial(req, KEY)).rejects.toMatchObject({ status: 409, code: "WALLET_NOT_ACTIVE" });
      const details = { limitType: "DAILY", limit: "5000.00", remaining: "120.00", resetAt: "2026-08-29T00:00:00.000Z" };
      fetchMock.mockResolvedValueOnce(
        jsonResponse(422, { status: "error", error: { code: "TRANSFER_LIMIT_EXCEEDED", message: "x", details } }),
      );
      await expect(transferCustodial(req, KEY)).rejects.toMatchObject({ status: 422, details });
    });
  });

  describe("edge case", () => {
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

// GET /api/v2/wallet/transfers + /{id} (USDX-701, wallet.yaml § transfers / transfer-detail).
describe("listWalletTransfers / getWalletTransfer", () => {
  const TRANSFER: WalletTransfer = {
    id: "0193abce-11aa-7bcd-8e01-5c2f0a9d4e77",
    txHash: "0x" + "ab".repeat(32),
    from: ACTIVE.address!,
    to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    amount: "25.000000",
    amountWei: "25000000",
    chain: "polygon",
    status: "CONFIRMED",
    failureReason: null,
    blockNumber: 76543210,
    submittedAt: "2026-08-28T04:20:11.000Z",
    finalizedAt: "2026-08-28T04:21:40.000Z",
  };

  describe("positive", () => {
    test("list GETs /api/v2/wallet/transfers with page/take and keeps the pagination metadata", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          status: "success",
          metadata: { page: 2, limit: 10, total: 11 },
          data: [TRANSFER],
        }),
      );

      const page = await listWalletTransfers({ page: 2, take: 10 });

      expect(page).toEqual({ data: [TRANSFER], metadata: { page: 2, limit: 10, total: 11 } });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/wallet/transfers?page=2&take=10");
      expect(init.method).toBe("GET");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
    });

    test("detail GETs /api/v2/wallet/transfers/{id} and unwraps the envelope", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: TRANSFER }));

      await expect(getWalletTransfer(TRANSFER.id)).resolves.toEqual(TRANSFER);
      expect(fetchMock.mock.calls[0][0]).toBe(`/api/v2/wallet/transfers/${TRANSFER.id}`);
    });
  });

  describe("negative", () => {
    test("detail 404 WALLET_TRANSFER_NOT_FOUND is thrown to the caller, not swallowed", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, {
          status: "error",
          error: { code: "WALLET_TRANSFER_NOT_FOUND", message: "Transfer tidak ditemukan" },
        }),
      );

      await expect(getWalletTransfer(TRANSFER.id)).rejects.toMatchObject({
        status: 404,
        code: "WALLET_TRANSFER_NOT_FOUND",
      });
    });

    test("429 RATE_LIMITED carries Retry-After for the tracker backoff", async () => {
      const res = jsonResponse(429, { status: "error", error: { code: "RATE_LIMITED", message: "x" } });
      (res.headers as Headers).set("Retry-After", "3");
      fetchMock.mockResolvedValueOnce(res);

      await expect(getWalletTransfer(TRANSFER.id)).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
        retryAfterSeconds: 3,
      });
    });
  });

  describe("edge case", () => {
    test("list without params sends no query string; an empty list stays empty", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", metadata: { page: 1, limit: 10, total: 0 }, data: [] }),
      );

      const page = await listWalletTransfers();

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/wallet/transfers");
      expect(page.data).toEqual([]);
      expect(page.metadata.total).toBe(0);
    });

    test("the id is URL-encoded — a stale value can never rewrite the path", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: TRANSFER }));

      await getWalletTransfer("../wallet");

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/wallet/transfers/..%2Fwallet");
    });
  });
});
