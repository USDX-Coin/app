import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, apiFetchPaginated, configureApiClient, ApiError } from "@/lib/api/client";

function jsonResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    headers: new Headers(headers),
    json: async () => payload,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  configureApiClient({ getToken: () => null, onUnauthorized: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  describe("positive", () => {
    test("unwraps the SoT success envelope and returns data", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { status: "success", metadata: {}, data: { id: "u1" } }),
      );
      const result = await apiFetch<{ id: string }>("/api/v2/auth/me");
      expect(result).toEqual({ id: "u1" });
    });

    test("returns the raw payload when the handler has no envelope", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: "u1" }));
      const result = await apiFetch<{ id: string }>("/api/v2/auth/me");
      expect(result).toEqual({ id: "u1" });
    });

    test("returns undefined for 204 No Content", async () => {
      fetchMock.mockResolvedValue(jsonResponse(204, null));
      await expect(apiFetch("/api/v2/auth/logout")).resolves.toBeUndefined();
    });

    test("attaches the Bearer token from the configured binding", async () => {
      configureApiClient({ getToken: () => "tok-123", onUnauthorized: () => {} });
      fetchMock.mockResolvedValue(jsonResponse(200, { status: "success", data: null }));
      await apiFetch("/api/v2/kyc/me");
      const [, init] = fetchMock.mock.calls[0];
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok-123");
    });

    test("does NOT send credentials: include (checkout handoff pindah ke bearer JWT, USDX-240)", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: "success", data: null }));
      await apiFetch("/api/v2/auth/me");
      const [, init] = fetchMock.mock.calls[0];
      expect(init.credentials).toBeUndefined();
    });

    test("serializes the body as JSON with Content-Type", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: "success", data: null }));
      await apiFetch("/api/v2/auth/login", { method: "POST", body: { email: "a@b.c" } });
      const [, init] = fetchMock.mock.calls[0];
      expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
      expect(init.body).toBe(JSON.stringify({ email: "a@b.c" }));
    });
  });

  describe("negative", () => {
    test("throws ApiError with code/message/details from the SoT error envelope", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(403, {
          status: "error",
          error: { code: "EMAIL_NOT_VERIFIED", message: "Verify first", details: { resendUrl: "/x" } },
        }),
      );
      const err = (await apiFetch("/api/v2/kyc").catch((e) => e)) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(403);
      expect(err.code).toBe("EMAIL_NOT_VERIFIED");
      expect(err.message).toBe("Verify first");
      expect(err.details).toEqual({ resendUrl: "/x" });
    });

    test("falls back to UNKNOWN code when the error body is not parseable", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        json: async () => {
          throw new Error("not json");
        },
      } as unknown as Response);
      const err = (await apiFetch("/api/v2/kyc").catch((e) => e)) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe("UNKNOWN");
      expect(err.message).toBe("Internal Server Error");
    });

    test("fires onUnauthorized on 401 before throwing", async () => {
      const onUnauthorized = vi.fn();
      configureApiClient({ getToken: () => "stale", onUnauthorized });
      fetchMock.mockResolvedValue(
        jsonResponse(401, { status: "error", error: { code: "UNAUTHORIZED", message: "nope" } }),
      );
      await expect(apiFetch("/api/v2/auth/me")).rejects.toThrow("nope");
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    test("fires onForbidden with the code on an authenticated 403 before throwing", async () => {
      const onForbidden = vi.fn();
      configureApiClient({ getToken: () => "tok", onUnauthorized: () => {}, onForbidden });
      fetchMock.mockResolvedValue(
        jsonResponse(403, { status: "error", error: { code: "ACCOUNT_SUSPENDED", message: "nope" } }),
      );
      await expect(apiFetch("/api/v2/mint")).rejects.toThrow("nope");
      expect(onForbidden).toHaveBeenCalledWith("ACCOUNT_SUSPENDED");
    });

    test("does NOT fire onForbidden on a skipAuth 403 (login/register keep inline handling)", async () => {
      const onForbidden = vi.fn();
      configureApiClient({ getToken: () => null, onUnauthorized: () => {}, onForbidden });
      fetchMock.mockResolvedValue(
        jsonResponse(403, { status: "error", error: { code: "ACCOUNT_SUSPENDED", message: "x" } }),
      );
      await expect(apiFetch("/api/v2/auth/login", { skipAuth: true })).rejects.toThrow("x");
      expect(onForbidden).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    test("parses Retry-After header into retryAfterSeconds on 429", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          429,
          { status: "error", error: { code: "TOO_MANY_ATTEMPTS", message: "slow down" } },
          { "Retry-After": "37" },
        ),
      );
      const err = (await apiFetch("/api/v2/auth/login").catch((e) => e)) as ApiError;
      expect(err.retryAfterSeconds).toBe(37);
    });

    test("falls back to details.retryAfterSeconds when the header is absent", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(429, {
          status: "error",
          error: { code: "TOO_MANY_REQUESTS", message: "slow down", details: { retryAfterSeconds: 12 } },
        }),
      );
      const err = (await apiFetch("/api/v2/auth/resend-verification").catch((e) => e)) as ApiError;
      expect(err.retryAfterSeconds).toBe(12);
    });

    test("retryAfterSeconds is null when neither header nor details carry it", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(429, { status: "error", error: { code: "TOO_MANY_ATTEMPTS", message: "x" } }),
      );
      const err = (await apiFetch("/api/v2/auth/login").catch((e) => e)) as ApiError;
      expect(err.retryAfterSeconds).toBeNull();
    });

    test("skipAuth omits the Authorization header even when a token exists", async () => {
      configureApiClient({ getToken: () => "tok-123", onUnauthorized: () => {} });
      fetchMock.mockResolvedValue(jsonResponse(200, { status: "success", data: null }));
      await apiFetch("/api/v2/auth/login", { method: "POST", body: {}, skipAuth: true });
      const [, init] = fetchMock.mock.calls[0];
      expect((init.headers as Headers).get("Authorization")).toBeNull();
    });
  });
});

describe("apiFetchPaginated", () => {
  describe("positive", () => {
    test("returns the data array together with the SoT pagination metadata", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          status: "success",
          metadata: { page: 2, limit: 10, total: 42 },
          data: [{ id: "a" }, { id: "b" }],
        }),
      );
      const result = await apiFetchPaginated<{ id: string }>("/api/v2/transactions?page=2");
      expect(result.data).toEqual([{ id: "a" }, { id: "b" }]);
      expect(result.metadata).toEqual({ page: 2, limit: 10, total: 42 });
    });
  });

  describe("edge cases", () => {
    test("defaults page/limit/total from the data when metadata is absent", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: "success", data: [{ id: "a" }] }));
      const result = await apiFetchPaginated<{ id: string }>("/api/v2/transactions");
      expect(result.metadata).toEqual({ page: 1, limit: 1, total: 1 });
    });
  });
});
