import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so getAppConfig hits apiFetch, not the mock.
vi.mock("@/lib/env", () => ({ env: { apiBaseUrl: "", useMock: false } }));

import { getAppConfig } from "@/lib/api/config-api";
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

// app-config.yaml § GET /api/v2/config (USDX-635, `mintMode` from USDX-636).
describe("getAppConfig", () => {
  const config = {
    minMintIdr: "20000.00",
    mintFeePct: "1.0",
    pgFeeVaFlat: "4000.00",
    contractAddress: "0x1FF2000000000000000000000000000000000000",
    chain: "polygon",
  };

  describe("positive", () => {
    test("GETs /api/v2/config with the bearer token and unwraps the envelope", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: config }));

      await expect(getAppConfig()).resolves.toEqual(config);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/config");
      expect(init.method).toBe("GET");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
    });

    test("passes mintMode through once the backend sends it (USDX-636)", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", data: { ...config, mintMode: "TEST" } }),
      );
      await expect(getAppConfig()).resolves.toMatchObject({ mintMode: "TEST" });
    });
  });

  describe("negative", () => {
    test("propagates ApiError on 401 (the endpoint needs a consumer session)", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { status: "error", error: { code: "UNAUTHORIZED", message: "nope" } }),
      );
      await expect(getAppConfig()).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    });
  });

  describe("edge cases", () => {
    test("a null contractAddress is passed through, not defaulted", async () => {
      // Chain not configured backend-side → null, endpoint still 200 (USDX-635).
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", data: { ...config, contractAddress: null } }),
      );
      await expect(getAppConfig()).resolves.toMatchObject({ contractAddress: null });
    });
  });
});
