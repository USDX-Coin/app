import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so getConsumerRate hits apiFetch, not the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import { getConsumerRate } from "@/lib/api/rate-api";
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

describe("getConsumerRate", () => {
  const rate = {
    baseRate: "16000.00",
    spreadBuyPct: "2.5",
    spreadSellPct: "2.0",
    effectiveBuyRate: "16400.00",
    updatedAt: "2026-06-17T00:00:00Z",
  };

  describe("positive", () => {
    test("GETs /api/v2/rate with the bearer token and unwraps the envelope", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: rate }));

      await expect(getConsumerRate()).resolves.toEqual(rate);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/rate");
      expect(init.method).toBe("GET");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
    });
  });

  describe("negative", () => {
    test("propagates ApiError on 401", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { status: "error", error: { code: "UNAUTHORIZED", message: "nope" } }),
      );
      await expect(getConsumerRate()).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    });
  });
});
