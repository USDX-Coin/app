import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useKycGate } from "@/hooks/useKycGate";
import { useAuthStore } from "@/stores/authStore";
import { getMyKycStatus } from "@/lib/api/kyc-api";
import type { KycMyStatus } from "@/types";

vi.mock("@/lib/api/kyc-api", () => ({ getMyKycStatus: vi.fn() }));
const getMyKycStatusMock = vi.mocked(getMyKycStatus);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: null, token: null, isAuthenticated: true });
  getMyKycStatusMock.mockReset();
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

      const { result } = renderHook(() => useKycGate(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      const action = vi.fn();
      act(() => result.current.guard(action));

      expect(action).not.toHaveBeenCalled();
      expect(result.current.open).toBe(true);
    });
  });
});
