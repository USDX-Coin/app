import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Force the real-backend branch so every call goes through apiFetch.
vi.mock("@/lib/env", () => ({
  env: { apiBaseUrl: "", useMock: false },
}));

import {
  disableTwoFactor,
  enableTwoFactor,
  recoverTwoFactorViaEmail,
  regenerateBackupCodes,
  verifyTwoFactor,
  verifyTwoFactorLogin,
} from "@/lib/api/two-factor-api";
import { configureApiClient } from "@/lib/api/client";

// two-factor.yaml (USDX-714). Session-gated calls (enable / verify / disable /
// regenerate) answer 401 for a wrong password or code — an in-form answer, so the
// global logout must stay quiet. verify-login and recovery live BEFORE the session
// (challenge cookie only): no bearer, and a 401 there is "log in again", not logout.

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    headers: new Headers(),
    json: async () => payload,
  } as unknown as Response;
}

function errorResponse(status: number, code: string) {
  return jsonResponse(status, { status: "error", error: { code, message: code } });
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

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return {
    url,
    method: init.method,
    auth: (init.headers as Headers).get("Authorization"),
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
    credentials: init.credentials,
  };
}

describe("two-factor-api", () => {
  describe("positive", () => {
    test("enable → POST /2fa/enable {password}, returns totpUri + backupCodes", async () => {
      const data = { totpUri: "otpauth://totp/x?secret=ABC", backupCodes: ["a", "b"] };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data }));

      await expect(enableTwoFactor({ password: "pw" })).resolves.toEqual(data);
      expect(lastCall()).toMatchObject({
        url: "/api/v2/auth/2fa/enable",
        method: "POST",
        auth: "Bearer session-token",
        body: { password: "pw" },
      });
    });

    test("verify → POST /2fa/verify {code}", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: null }));
      await expect(verifyTwoFactor({ code: "123456" })).resolves.toBeUndefined();
      expect(lastCall()).toMatchObject({ url: "/api/v2/auth/2fa/verify", body: { code: "123456" } });
    });

    test("disable → POST /2fa/disable with the password OR the code, never both", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: "success", data: null }));

      await disableTwoFactor({ password: "pw" });
      expect(lastCall()).toMatchObject({ url: "/api/v2/auth/2fa/disable", body: { password: "pw" } });

      await disableTwoFactor({ code: "123456" });
      expect(lastCall().body).toEqual({ code: "123456" });
    });

    test("regenerate → POST /2fa/backup-codes/regenerate {password}, returns the new set", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: "success", data: { backupCodes: ["x", "y"] } }),
      );
      await expect(regenerateBackupCodes({ password: "pw" })).resolves.toEqual(["x", "y"]);
      expect(lastCall()).toMatchObject({
        url: "/api/v2/auth/2fa/backup-codes/regenerate",
        body: { password: "pw" },
      });
    });

    test("verify-login → AuthTokenV2 mapped to the stored session; no bearer, cookies included", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          status: "success",
          data: { accessToken: null, sessionId: "sid", user: { id: "usr_1" } },
        }),
      );

      await expect(verifyTwoFactorLogin({ code: "123456" })).resolves.toEqual({
        token: "sid",
        user: { id: "usr_1" },
      });
      expect(lastCall()).toMatchObject({
        url: "/api/v2/auth/2fa/verify-login",
        auth: null,
        body: { code: "123456" },
        credentials: "include",
      });
    });

    test("recovery: no code = send the OTP (empty body), with code = verify", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: "success", data: null }));

      await recoverTwoFactorViaEmail();
      expect(lastCall()).toMatchObject({
        url: "/api/v2/auth/2fa/recovery/email",
        auth: null,
        body: {},
      });

      await recoverTwoFactorViaEmail("135790");
      expect(lastCall().body).toEqual({ code: "135790" });
    });
  });

  describe("negative", () => {
    test("401 on the session-gated calls rejects WITHOUT firing the global logout", async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(401, "INVALID_CREDENTIALS"));
      await expect(enableTwoFactor({ password: "x" })).rejects.toMatchObject({ status: 401 });
      fetchMock.mockResolvedValueOnce(errorResponse(401, "INVALID_TWO_FACTOR_CODE"));
      await expect(verifyTwoFactor({ code: "1" })).rejects.toMatchObject({ status: 401 });
      fetchMock.mockResolvedValueOnce(errorResponse(401, "INVALID_CREDENTIALS"));
      await expect(disableTwoFactor({ password: "x" })).rejects.toMatchObject({ status: 401 });
      fetchMock.mockResolvedValueOnce(errorResponse(401, "INVALID_CREDENTIALS"));
      await expect(regenerateBackupCodes({ password: "x" })).rejects.toMatchObject({ status: 401 });

      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    test("401 at verify-login / recovery rejects WITHOUT firing the global logout", async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(401, "TWO_FACTOR_CHALLENGE_EXPIRED"));
      await expect(verifyTwoFactorLogin({ code: "1" })).rejects.toMatchObject({
        code: "TWO_FACTOR_CHALLENGE_EXPIRED",
      });
      fetchMock.mockResolvedValueOnce(errorResponse(401, "INVALID_TWO_FACTOR_CODE"));
      await expect(recoverTwoFactorViaEmail("0")).rejects.toMatchObject({
        code: "INVALID_TWO_FACTOR_CODE",
      });

      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("an empty recovery code is sent as a request for the OTP, not as a code", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", data: null }));
      await recoverTwoFactorViaEmail("");
      expect(lastCall().body).toEqual({});
    });
  });
});
