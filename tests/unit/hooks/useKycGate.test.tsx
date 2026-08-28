import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useKycGate } from "@/hooks/useKycGate";
import { useAuthStore } from "@/stores/authStore";
import { getMyKycStatus } from "@/lib/api/kyc-api";
import { getMe } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/client";
import type { KycMyStatus, User } from "@/types";

vi.mock("@/lib/api/kyc-api", () => ({ getMyKycStatus: vi.fn() }));
vi.mock("@/lib/api/auth-api", () => ({ getMe: vi.fn() }));
const getMyKycStatusMock = vi.mocked(getMyKycStatus);
const getMeMock = vi.mocked(getMe);

const VERIFIED_USER: User = {
  id: "usr_1",
  name: "Test User",
  email: "test@example.com",
  phone: "+628123456789",
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const offline = () => new ApiError(503, "SERVICE_UNAVAILABLE", "backend unreachable");

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: null, token: null, isAuthenticated: true });
  getMyKycStatusMock.mockReset();
  getMeMock.mockReset();
  // Default: /auth/me never settles, so specs that care only about /kyc/me stay in
  // the "user not here yet" state unless they say otherwise.
  getMeMock.mockReturnValue(new Promise<User>(() => {}));
});

describe("useKycGate", () => {
  describe("edge cases", () => {
    // The user object is no longer read from localStorage, so on a cold load both
    // the /v2/kyc/me query and the /v2/auth/me refresh are still in flight. Treating
    // that window as UNVERIFIED would slam a "complete your KYC" dialog in the face
    // of a customer who IS verified.
    test("while the status is unknown the gate neither blocks nor opens the dialog", async () => {
      const d = deferred<KycMyStatus>();
      getMyKycStatusMock.mockReturnValue(d.promise);

      const { result } = renderHook(() => useKycGate(), { wrapper: createWrapper() });

      expect(result.current.loading).toBe(true);

      const action = vi.fn();
      act(() => result.current.guard(action));

      expect(result.current.open).toBe(false);
      expect(action).not.toHaveBeenCalled();

      await act(async () => {
        d.resolve({ status: "VERIFIED" });
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    // A disabled button with no explanation is the worst thing to hand a customer:
    // they cannot tell whether the app is broken, their account is, or they are.
    test("loading alone never claims the server is unreachable", async () => {
      const d = deferred<KycMyStatus>();
      getMyKycStatusMock.mockReturnValue(d.promise);

      const { result } = renderHook(() => useKycGate(), { wrapper: createWrapper() });

      expect(result.current.loading).toBe(true);
      expect(result.current.unavailable).toBe(false);

      await act(async () => {
        d.resolve({ status: "VERIFIED" });
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.unavailable).toBe(false);
    });

    test("one source failing is not 'unreachable' — the other still answers", async () => {
      getMyKycStatusMock.mockRejectedValue(offline());
      getMeMock.mockResolvedValue(VERIFIED_USER);
      useAuthStore.setState({ user: VERIFIED_USER });

      const { result } = renderHook(() => useKycGate(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.unavailable).toBe(false);
      expect(result.current.verified).toBe(true);
    });
  });

  describe("positive", () => {
    test("a VERIFIED customer runs the action once the status has arrived", async () => {
      getMyKycStatusMock.mockResolvedValue({ status: "VERIFIED" });

      const { result } = renderHook(() => useKycGate(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.verified).toBe(true));
      expect(result.current.loading).toBe(false);

      const action = vi.fn();
      act(() => result.current.guard(action));

      expect(action).toHaveBeenCalledTimes(1);
      expect(result.current.open).toBe(false);
    });
  });

  describe("negative", () => {
    test("an UNVERIFIED customer opens the gate dialog instead of the action", async () => {
      getMyKycStatusMock.mockResolvedValue({ status: "UNVERIFIED" });
      getMeMock.mockResolvedValue({ ...VERIFIED_USER, kycStatus: "UNVERIFIED" });

      const { result } = renderHook(() => useKycGate(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      const action = vi.fn();
      act(() => result.current.guard(action));

      expect(action).not.toHaveBeenCalled();
      expect(result.current.open).toBe(true);
    });

    // Both sources down, no 401 in sight: the CTA stays disabled (the transaction
    // could not go through anyway) but the customer is told WHY.
    test("both sources failing without a 401 reports unreachable and keeps the CTA locked", async () => {
      getMyKycStatusMock.mockRejectedValue(offline());
      getMeMock.mockRejectedValue(offline());

      const { result } = renderHook(() => useKycGate(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.unavailable).toBe(true));

      expect(result.current.loading).toBe(true);

      const action = vi.fn();
      act(() => result.current.guard(action));

      expect(action).not.toHaveBeenCalled();
      expect(result.current.open).toBe(false); // no dialog — this is not a KYC verdict
    });

    // A 401 is an expired session, not an unreachable server. ApiClientBridge already
    // clears the session and bounces to /login, so claiming a connection problem here
    // would point the customer at the wrong thing.
    test("a 401 is not reported as unreachable", async () => {
      const expired = new ApiError(401, "UNAUTHORIZED", "session expired");
      getMyKycStatusMock.mockRejectedValue(expired);
      getMeMock.mockRejectedValue(expired);

      const { result } = renderHook(() => useKycGate(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe("UNVERIFIED"));

      expect(result.current.unavailable).toBe(false);
    });
  });
});
