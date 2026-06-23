import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so the module hits apiFetch, not the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import {
  listBankAccounts,
  addBankAccount,
  deleteBankAccount,
} from "@/lib/api/bank-accounts-api";
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
  configureApiClient({ getToken: () => "session-token", onUnauthorized: () => {}, onForbidden: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ENTRY = {
  id: "b1",
  bankCode: "014",
  accountNumberMasked: "••••••3210",
  accountName: "SINGGIH BRILIAN TARA",
  label: "BCA utama",
  createdAt: "2026-06-17T00:00:00Z",
};

describe("listBankAccounts", () => {
  describe("positive", () => {
    test("GETs /api/v2/bank-accounts and returns the entries", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: [ENTRY] }));

      await expect(listBankAccounts()).resolves.toEqual([ENTRY]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/bank-accounts");
      expect(init.method).toBe("GET");
    });
  });
});

describe("addBankAccount", () => {
  const body = {
    bankCode: "014",
    accountNumber: "1234563210",
    accountName: "SINGGIH BRILIAN TARA",
    label: "BCA utama",
  };

  describe("positive", () => {
    test("POSTs the body to /api/v2/bank-accounts", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { status: "success", data: ENTRY }));

      await expect(addBankAccount(body)).resolves.toEqual(ENTRY);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/bank-accounts");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual(body);
    });
  });

  describe("negative", () => {
    test("propagates 409 BANK_ACCOUNT_ALREADY_EXISTS for a duplicate", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, {
          status: "error",
          error: { code: "BANK_ACCOUNT_ALREADY_EXISTS", message: "dup" },
        }),
      );
      await expect(addBankAccount(body)).rejects.toMatchObject({
        status: 409,
        code: "BANK_ACCOUNT_ALREADY_EXISTS",
      });
    });

    test("propagates 422 VALIDATION_ERROR", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(422, { status: "error", error: { code: "VALIDATION_ERROR", message: "bad" } }),
      );
      await expect(addBankAccount(body)).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
    });
  });
});

describe("deleteBankAccount", () => {
  describe("positive", () => {
    test("DELETEs /api/v2/bank-accounts/{id}", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: { id: "b1" } }));

      await expect(deleteBankAccount("b1")).resolves.toEqual({ id: "b1" });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/bank-accounts/b1");
      expect(init.method).toBe("DELETE");
    });
  });

  describe("negative", () => {
    test("propagates 404 for another user's entry", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { status: "error", error: { code: "NOT_FOUND", message: "no" } }),
      );
      await expect(deleteBankAccount("b9")).rejects.toMatchObject({ status: 404 });
    });
  });
});
