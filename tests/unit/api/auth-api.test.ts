import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so logout() hits apiFetch instead of the mock.
vi.mock("@/lib/env", () => ({
  env: { apiBaseUrl: "", useMock: false },
}));

import { logout } from "@/lib/api/auth-api";
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

describe("logout", () => {
  describe("positive", () => {
    test("POSTs /api/v2/auth/logout with the bearer token", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success" }));

      await expect(logout()).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/auth/logout");
      expect(init.method).toBe("POST");
      expect((init.headers as Headers).get("Authorization")).toBe(
        "Bearer session-token",
      );
    });
  });

  describe("negative", () => {
    test("401 (double logout / session already gone) rejects so callers can swallow it", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, {
          status: "error",
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        }),
      );

      await expect(logout()).rejects.toMatchObject({ status: 401 });
      // ApiClientBridge's onUnauthorized no-ops once the store is already
      // logged out — the fire-and-forget caller pattern stays safe.
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    test("network failure rejects without throwing synchronously (fire-and-forget safe)", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(logout().catch(() => "swallowed")).resolves.toBe("swallowed");
    });
  });
});
