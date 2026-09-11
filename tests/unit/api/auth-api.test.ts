import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so logout() hits apiFetch instead of the mock.
vi.mock("@/lib/env", () => ({
  env: { apiBaseUrl: "", useMock: false },
}));

import { logout, changePassword, setPin, changePin } from "@/lib/api/auth-api";
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

describe("changePassword", () => {
  const body = {
    currentPassword: "Demo1234",
    newPassword: "NewPass1",
    confirmNewPassword: "NewPass1",
  };

  describe("positive", () => {
    test("POSTs /api/v2/auth/change-password with the bearer token + body", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success" }));

      await expect(changePassword(body)).resolves.toBeUndefined();

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/auth/change-password");
      expect(init.method).toBe("POST");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
      expect(JSON.parse(init.body)).toEqual(body);
    });
  });

  describe("negative", () => {
    test("401 INVALID_CREDENTIALS rejects WITHOUT firing the global logout handler", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, {
          status: "error",
          error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect" },
        }),
      );

      await expect(changePassword(body)).rejects.toMatchObject({
        status: 401,
        code: "INVALID_CREDENTIALS",
      });
      // skipUnauthorizedHandler — the session is still valid, so no logout/redirect.
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });
});

// PIN akun (pin.yaml § set / change, USDX-651). Both are in-form calls: a 401 is
// INVALID_PIN / REAUTH_REQUIRED / PIN_NOT_SET, never "session expired", so the
// global logout handler must stay quiet.
describe("setPin", () => {
  describe("positive", () => {
    test("POSTs /api/v2/auth/pin/set with the bearer token + body (first-time set: no currentPin)", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: null }));

      await expect(setPin({ pin: "654321" })).resolves.toBeUndefined();

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/auth/pin/set");
      expect(init.method).toBe("POST");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
      expect(JSON.parse(init.body)).toEqual({ pin: "654321" });
    });
  });

  describe("negative", () => {
    test("401 REAUTH_REQUIRED (overwrite of an existing PIN) rejects WITHOUT firing the global logout handler", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, {
          status: "error",
          error: { code: "REAUTH_REQUIRED", message: "Re-authentication required" },
        }),
      );

      await expect(setPin({ pin: "654321" })).rejects.toMatchObject({
        status: 401,
        code: "REAUTH_REQUIRED",
      });
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("currentPin, when given, travels in the body as-is", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: null }));

      await setPin({ pin: "654321", currentPin: "123456" });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        pin: "654321",
        currentPin: "123456",
      });
    });
  });
});

describe("changePin", () => {
  const body = { currentPin: "123456", newPin: "654321" };

  describe("positive", () => {
    test("POSTs /api/v2/auth/pin/change with the bearer token + body", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: null }));

      await expect(changePin(body)).resolves.toBeUndefined();

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v2/auth/pin/change");
      expect(init.method).toBe("POST");
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
      expect(JSON.parse(init.body)).toEqual(body);
    });
  });

  describe("negative", () => {
    test("401 INVALID_PIN (wrong current PIN) rejects WITHOUT firing the global logout handler", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, {
          status: "error",
          error: { code: "INVALID_PIN", message: "PIN salah" },
        }),
      );

      await expect(changePin(body)).rejects.toMatchObject({ status: 401, code: "INVALID_PIN" });
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("429 TOO_MANY_ATTEMPTS carries Retry-After from the body details", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(429, {
          status: "error",
          error: {
            code: "TOO_MANY_ATTEMPTS",
            message: "x",
            details: { retryAfterSeconds: 900 },
          },
        }),
      );

      await expect(changePin(body)).rejects.toMatchObject({
        status: 429,
        code: "TOO_MANY_ATTEMPTS",
        retryAfterSeconds: 900,
      });
    });
  });
});
