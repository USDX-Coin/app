import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { createCustodialWallet, getCustodialWallet } from "@/lib/api/wallet-api";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/authStore";
import type { CustodialWallet, User } from "@/types";

vi.mock("@/lib/api/wallet-api", () => ({
  getCustodialWallet: vi.fn(),
  createCustodialWallet: vi.fn(),
}));
const getMock = vi.mocked(getCustodialWallet);
const createMock = vi.mocked(createCustodialWallet);

const ADDRESS = "0x000000C528aE908fB929a0898B65e913623c9aFf";

const USER: User = {
  id: "usr_1",
  name: "Demo User",
  email: "demo@usdx.com",
  phone: "+628123456789",
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  custodialWallet: null,
};

function wallet(overrides: Partial<CustodialWallet> = {}): CustodialWallet {
  return {
    address: ADDRESS,
    status: "ACTIVE",
    chain: "polygon",
    contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
    balance: "125.50",
    balanceWei: "125500000",
    balanceAt: "2026-09-11T08:00:00.000Z",
    createdAt: "2026-09-11T07:59:00.000Z",
    ...overrides,
  };
}

const PROVISIONING = wallet({
  address: null,
  status: "PROVISIONING",
  balance: null,
  balanceWei: null,
  balanceAt: null,
});

function signIn(custodialWallet: User["custodialWallet"] = null) {
  useAuthStore.getState().setAuth({ ...USER, custodialWallet }, "token");
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  getMock.mockReset();
  createMock.mockReset();
  useAuthStore.getState().logout();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCustodialWallet", () => {
  describe("positive", () => {
    test("reads GET /wallet only when the profile says the user has one, and exposes the balance", async () => {
      signIn({ address: ADDRESS, status: "ACTIVE" });
      getMock.mockResolvedValue(wallet());

      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.status).toBe("ACTIVE"));
      expect(getMock).toHaveBeenCalledTimes(1);
      expect(result.current.wallet?.address).toBe(ADDRESS);
      expect(result.current.balanceUsdx).toBe(125.5);
      expect(result.current.balanceAt).toBe("2026-09-11T08:00:00.000Z");
      expect(result.current.isPolling).toBe(false);
    });

    test("create → PROVISIONING lands in the profile copy, then polling GET reaches ACTIVE and syncs it", async () => {
      signIn(null);
      createMock.mockResolvedValue(PROVISIONING);
      getMock
        .mockResolvedValueOnce(PROVISIONING)
        .mockResolvedValueOnce(PROVISIONING)
        .mockResolvedValue(wallet({ balance: "0.00", balanceWei: "0" }));

      const { result } = renderHook(() => useCustodialWallet({ poll: true }), {
        wrapper: createWrapper(),
      });
      expect(result.current.status).toBe("none");

      await act(() => result.current.create());

      // The 202 body seeds the query — no GET is needed to show PROVISIONING —
      // and the profile copy learns about the wallet straight away.
      expect(result.current.status).toBe("PROVISIONING");
      expect(useAuthStore.getState().user?.custodialWallet).toEqual({
        address: null,
        status: "PROVISIONING",
      });
      expect(result.current.isPolling).toBe(true);

      // Two polls answer PROVISIONING, the third answers ACTIVE. Advancing the
      // fake clock past each 3 s interval is what fires the refetch.
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3_100);
        });
      }
      await waitFor(() => expect(result.current.status).toBe("ACTIVE"));
      expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(useAuthStore.getState().user?.custodialWallet).toEqual({
        address: ADDRESS,
        status: "ACTIVE",
      });
      // A fresh wallet holds a real zero — shown as 0, not as "unknown".
      expect(result.current.balanceUsdx).toBe(0);
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe("negative", () => {
    test("a user without a wallet never triggers GET /wallet (no 404 swallowed on cold start)", async () => {
      signIn(null);

      const { result } = renderHook(() => useCustodialWallet({ poll: true }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(getMock).not.toHaveBeenCalled();
      expect(result.current.status).toBe("none");
      expect(result.current.isLoading).toBe(false);
    });

    test("create → 409 WALLET_ALREADY_EXISTS falls back to GET, which reveals the real wallet", async () => {
      // The profile copy is stale (says none) but the backend has an ACTIVE wallet.
      signIn(null);
      createMock.mockRejectedValue(
        new ApiError(409, "WALLET_ALREADY_EXISTS", "Kamu sudah punya wallet custodial"),
      );
      getMock.mockResolvedValue(wallet());

      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });
      await act(() => result.current.create());

      expect(result.current.createError).toMatchObject({ code: "WALLET_ALREADY_EXISTS" });
      await waitFor(() => expect(result.current.status).toBe("ACTIVE"));
      expect(useAuthStore.getState().user?.custodialWallet?.address).toBe(ADDRESS);
    });

    test("create → 503 WALLET_SERVICE_UNAVAILABLE surfaces createError and touches nothing else", async () => {
      signIn(null);
      createMock.mockRejectedValue(
        new ApiError(503, "WALLET_SERVICE_UNAVAILABLE", "Layanan wallet sedang tidak tersedia"),
      );

      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });
      await act(() => result.current.create());

      await waitFor(() => expect(result.current.createError).toMatchObject({ status: 503 }));
      expect(result.current.status).toBe("none");
      expect(getMock).not.toHaveBeenCalled();
      expect(useAuthStore.getState().user?.custodialWallet).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("polling stops after the budget and reports provisioningTimedOut; retry (POST again) restarts it", async () => {
      signIn({ address: null, status: "PROVISIONING" });
      getMock.mockResolvedValue(PROVISIONING);
      createMock.mockResolvedValue(PROVISIONING);

      const { result } = renderHook(
        () => useCustodialWallet({ poll: true, pollBudgetMs: 2_000 }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.status).toBe("PROVISIONING"));
      expect(result.current.isPolling).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_100);
      });
      expect(result.current.provisioningTimedOut).toBe(true);
      expect(result.current.isPolling).toBe(false);

      // No more GETs once the window is over — the UI now carries the retry.
      const callsAtTimeout = getMock.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(getMock.mock.calls.length).toBe(callsAtTimeout);

      // "Coba lagi" = POST again → 202, and a fresh polling window.
      await act(() => result.current.create());
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(result.current.provisioningTimedOut).toBe(false);
      expect(result.current.isPolling).toBe(true);
    });

    test("poll: false never schedules a refetch, even while PROVISIONING (sidebar)", async () => {
      signIn({ address: null, status: "PROVISIONING" });
      getMock.mockResolvedValue(PROVISIONING);

      const { result } = renderHook(() => useCustodialWallet({ poll: false }), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.status).toBe("PROVISIONING"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(getMock).toHaveBeenCalledTimes(1);
      expect(result.current.isPolling).toBe(false);
      expect(result.current.provisioningTimedOut).toBe(false);
    });

    test("balance null on an ACTIVE wallet stays null — never rendered as 0", async () => {
      signIn({ address: ADDRESS, status: "ACTIVE" });
      getMock.mockResolvedValue(wallet({ balance: null, balanceWei: null, balanceAt: null }));

      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.status).toBe("ACTIVE"));
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.balanceAt).toBeNull();
    });

    test("GET answering 'no wallet' clears a stale profile copy", async () => {
      signIn({ address: ADDRESS, status: "ACTIVE" });
      getMock.mockResolvedValue(null);

      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.status).toBe("none"));
      expect(useAuthStore.getState().user?.custodialWallet).toBeNull();
    });
  });
});
