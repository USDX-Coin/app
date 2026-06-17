import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so the module hits apiFetch, not the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import {
  listAddressBook,
  addAddressBookEntry,
  deleteAddressBookEntry,
} from "@/lib/api/address-book-api";
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

describe("listAddressBook", () => {
  describe("positive", () => {
    test("GETs /api/v2/address-book and returns the entries", async () => {
      const entries = [{ id: "a1", address: "0xabc", label: "John", createdAt: "2026-06-17T00:00:00Z" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: entries }));

      await expect(listAddressBook()).resolves.toEqual(entries);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/address-book");
      expect(init.method).toBe("GET");
    });
  });
});

describe("addAddressBookEntry", () => {
  const body = { address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", label: "John Doe" };

  describe("positive", () => {
    test("POSTs the body to /api/v2/address-book", async () => {
      const created = { id: "a2", ...body, createdAt: "2026-06-17T00:00:00Z" };
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { status: "success", data: created }));

      await expect(addAddressBookEntry(body)).resolves.toEqual(created);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/address-book");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual(body);
    });
  });

  describe("negative", () => {
    test("propagates 409 ADDRESS_ALREADY_EXISTS for a duplicate", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, { status: "error", error: { code: "ADDRESS_ALREADY_EXISTS", message: "dup" } }),
      );
      await expect(addAddressBookEntry(body)).rejects.toMatchObject({
        status: 409,
        code: "ADDRESS_ALREADY_EXISTS",
      });
    });
  });
});

describe("deleteAddressBookEntry", () => {
  describe("positive", () => {
    test("DELETEs /api/v2/address-book/{id}", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: { id: "a1" } }));

      await expect(deleteAddressBookEntry("a1")).resolves.toEqual({ id: "a1" });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/address-book/a1");
      expect(init.method).toBe("DELETE");
    });
  });

  describe("negative", () => {
    test("propagates 404 for another user's entry", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { status: "error", error: { code: "NOT_FOUND", message: "no" } }),
      );
      await expect(deleteAddressBookEntry("a9")).rejects.toMatchObject({ status: 404 });
    });
  });
});
