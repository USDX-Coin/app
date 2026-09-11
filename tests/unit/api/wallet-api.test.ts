import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so both calls hit apiFetch instead of the mock.
vi.mock("@/lib/env", () => ({
  env: { apiBaseUrl: "", useMock: false },
}));

import { createCustodialWallet, getCustodialWallet } from "@/lib/api/wallet-api";
import { configureApiClient } from "@/lib/api/client";
import type { CustodialWallet } from "@/types";

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
