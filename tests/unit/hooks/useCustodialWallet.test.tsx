import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useCustodialWallet } from "@/hooks/useCustodialWallet";
import { useAuthStore } from "@/stores/authStore";
import { getCustodialWallet } from "@/lib/api/wallet-api";
import type { CustodialWallet, User } from "@/types";

vi.mock("@/lib/api/wallet-api", () => ({ getCustodialWallet: vi.fn() }));
const getWalletMock = vi.mocked(getCustodialWallet);

const ADDRESS = "0x000000C528aE908fB929a0898B65e913623c9aFf";
const BASE_USER: User = {
  id: "usr_1",
  name: "Demo",
  email: "demo@usdx.com",
  phone: null,
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const WALLET: CustodialWallet = {
  address: ADDRESS,
  status: "ACTIVE",
  chain: "polygon",
  contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
  balance: "125.50",
  balanceWei: "125500000",
  balanceAt: "2026-08-28T04:12:31.000Z",
  createdAt: "2026-08-28T04:10:00.000Z",
};

function setUser(overrides: Partial<User>) {
  useAuthStore.setState({ user: { ...BASE_USER, ...overrides }, isAuthenticated: true, token: "t" });
}

beforeEach(() => {
  getWalletMock.mockReset();
  useAuthStore.setState({ user: null, isAuthenticated: false, token: null });
});

describe("useCustodialWallet", () => {
  describe("positive", () => {
    test("ACTIVE wallet: reads the detail and exposes a ready balance", async () => {
      setUser({ custodialWallet: { address: ADDRESS, status: "ACTIVE" }, pinSet: true });
      getWalletMock.mockResolvedValue(WALLET);
      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });

      expect(result.current.hasWallet).toBe(true);
      expect(result.current.address).toBe(ADDRESS);
      await waitFor(() => expect(result.current.balanceState).toBe("ready"));
      expect(result.current.isActive).toBe(true);
      expect(result.current.balanceUsdx).toBe(125.5);
      expect(result.current.pinSet).toBe(true);
    });

    test("summary alone already answers hasWallet/address before the detail lands", () => {
      setUser({ custodialWallet: { address: ADDRESS, status: "ACTIVE" } });
      getWalletMock.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });
      expect(result.current.hasWallet).toBe(true);
      expect(result.current.address).toBe(ADDRESS);
      expect(result.current.isActive).toBe(true);
      expect(result.current.balanceState).toBe("loading");
      expect(result.current.balanceUsdx).toBeNull();
    });
  });

  describe("negative", () => {
    test("no custodialWallet on the profile → GET is never called", () => {
      setUser({ custodialWallet: null });
      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });
      expect(result.current.hasWallet).toBe(false);
      expect(result.current.isActive).toBe(false);
      expect(result.current.balanceState).toBe("none");
      expect(getWalletMock).not.toHaveBeenCalled();
    });

    test("PROVISIONING is not active and has no balance", async () => {
      setUser({ custodialWallet: { address: null, status: "PROVISIONING" } });
      getWalletMock.mockResolvedValue({ ...WALLET, address: null, status: "PROVISIONING", balance: null, balanceWei: null, balanceAt: null });
      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(result.current.hasWallet).toBe(true);
      expect(result.current.isActive).toBe(false);
      expect(result.current.status).toBe("PROVISIONING");
      expect(result.current.balanceUsdx).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("an unreadable balance (null) is 'unavailable', never 0", async () => {
      setUser({ custodialWallet: { address: ADDRESS, status: "ACTIVE" } });
      getWalletMock.mockResolvedValue({ ...WALLET, balance: null, balanceWei: null, balanceAt: null });
      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.balanceState).toBe("unavailable"));
      expect(result.current.balanceUsdx).toBeNull();
      expect(result.current.isActive).toBe(true);
    });

    test("a stale persisted summary is overruled when GET says there is no wallet", async () => {
      setUser({ custodialWallet: { address: ADDRESS, status: "ACTIVE" } });
      getWalletMock.mockResolvedValue(null);
      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.hasWallet).toBe(false));
      expect(result.current.address).toBeNull();
      expect(result.current.balanceState).toBe("none");
    });

    test("a persisted session without the field is read as 'no wallet' and pinSet unknown", () => {
      setUser({});
      const { result } = renderHook(() => useCustodialWallet(), { wrapper: createWrapper() });
      expect(result.current.hasWallet).toBe(false);
      expect(result.current.pinSet).toBeNull();
    });
  });
});
