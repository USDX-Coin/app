import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useRedeem, redeemErrorKey } from "@/hooks/useRedeem";
import { useRedeemStore } from "@/stores/redeemStore";
import { useAuthStore } from "@/stores/authStore";
import { createRedeemOrder, reportBurnTx } from "@/lib/api/redeem-api";
import { getCustodialWallet } from "@/lib/api/wallet-api";
import { ApiError } from "@/lib/api/client";
import type { CustodialWallet, RedeemOrderCreated, User } from "@/types";

// No WagmiProvider in jsdom — stub the wallet hooks. The external wallet is
// deliberately NOT connected here: the custodial path must never need it.
vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));
const writeSpy = vi.fn();
vi.mock("@/lib/redeem/wallet", () => ({
  useRedeemWallet: () => ({ isConnected: false, address: undefined, connect: () => {} }),
  useRedeemPreconditions: () => ({
    isConnected: false,
    address: undefined,
    connect: () => {},
    chainOk: false,
    switchNetwork: () => {},
    isSwitchingNetwork: false,
    balanceUsdx: null,
    insufficientBalance: false,
    lowGasWarning: false,
    canBurn: false,
  }),
}));
vi.mock("@/lib/redeem/burn", () => ({
  REDEEM_ABI: [],
  signAndBroadcastBurn: (...args: unknown[]) => {
    writeSpy(...args);
    return Promise.resolve({ burnTxHash: "0x" + "cd".repeat(32) });
  },
}));
vi.mock("@/lib/api/redeem-api", () => ({
  createRedeemOrder: vi.fn(),
  getRedeemOrder: vi.fn(),
  reportBurnTx: vi.fn(),
}));
vi.mock("@/lib/api/wallet-api", () => ({ getCustodialWallet: vi.fn() }));

const createMock = vi.mocked(createRedeemOrder);
const reportMock = vi.mocked(reportBurnTx);
const getWalletMock = vi.mocked(getCustodialWallet);

const CUSTODIAL = "0x000000C528aE908fB929a0898B65e913623c9aFf";
const SELL_RATE = 15680;
const USER: User = {
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
  pinSet: true,
  custodialWallet: { address: CUSTODIAL, status: "ACTIVE" },
};
const WALLET: CustodialWallet = {
  address: CUSTODIAL,
  status: "ACTIVE",
  chain: "polygon",
  contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
  balance: "500.00",
  balanceWei: "500000000",
  balanceAt: "2026-08-28T04:12:31.000Z",
  createdAt: "2026-08-28T04:10:00.000Z",
};
const ORDER = {
  id: "rdm_1",
  userAddress: CUSTODIAL,
  burnMode: "CUSTODIAL",
  status: "AWAITING_BURN",
  redeemId: "0x" + "ab".repeat(32),
  amountWei: "100000000",
  contractAddress: "0x1eaed5000000000000000000000000000000d5e5",
} as RedeemOrderCreated;

function fillForm() {
  const s = useRedeemStore.getState();
  s.setAmount("100");
  s.setBankCode("014");
  s.setBankAccountNumber("1234563210");
  s.setBankAccountName("SINGGIH BRILIAN TARA");
}

beforeEach(() => {
  useRedeemStore.getState().reset();
  useAuthStore.setState({ user: USER, isAuthenticated: true, token: "t" });
  createMock.mockReset();
  createMock.mockResolvedValue(ORDER);
  reportMock.mockReset();
  getWalletMock.mockReset();
  getWalletMock.mockResolvedValue(WALLET);
  writeSpy.mockReset();
});

// Redeem from the custodial wallet (USDX-567, custodial-wallet.md §5.3): PIN in
// the create body is the approval; `burnMode` comes back from the backend; no
// wallet signature and no burn-tx report ever happen on the client.
describe("useRedeem — custodial source", () => {
  describe("positive", () => {
    test("custodial owner: source defaults to custodial, no connect needed, balance from GET /wallet", async () => {
      fillForm();
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.effectiveSellRate).toBe(SELL_RATE));
      expect(result.current.custodialAvailable).toBe(true);
      expect(result.current.isCustodialSource).toBe(true);
      expect(result.current.isWalletConnected).toBe(true); // nothing to connect
      expect(result.current.walletAddress).toBe(CUSTODIAL);
      await waitFor(() => expect(result.current.balanceUsdx).toBe(500));
      expect(result.current.chainOk).toBe(true);
      expect(result.current.lowGasWarning).toBe(false);
      expect(result.current.canBurn).toBe(true);
      expect(result.current.isFormValid).toBe(true);
    });

    test("submit with PIN sends userAddress = custodial + pin, goes to the tracker, and NEVER signs or reports", async () => {
      fillForm();
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isFormValid).toBe(true));
      act(() => result.current.openPin());
      await act(async () => {
        await result.current.submitRedeem("123456");
      });
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ userAddress: CUSTODIAL, pin: "123456" }),
      );
      const s = useRedeemStore.getState();
      expect(s.step).toBe("tracker");
      expect(s.orderId).toBe("rdm_1");
      expect(s.burnState).toBe("idle"); // no client-side burn started
      expect(writeSpy).not.toHaveBeenCalled();
      expect(reportMock).not.toHaveBeenCalled();
    });

    test("setMaxAmount uses the custodial balance", async () => {
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.balanceUsdx).toBe(500));
      act(() => result.current.setMaxAmount());
      expect(useRedeemStore.getState().amount).toBe("500");
    });
  });

  describe("negative", () => {
    test("wrong PIN → pinErrorKey, dialog stays open, no order", async () => {
      fillForm();
      createMock.mockRejectedValueOnce(new ApiError(401, "INVALID_PIN", "PIN salah"));
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isFormValid).toBe(true));
      act(() => result.current.openPin());
      await act(async () => {
        await result.current.submitRedeem("000000").catch(() => undefined);
      });
      await waitFor(() => expect(result.current.pinErrorKey).toBe("pin.errInvalid"));
      expect(result.current.createErrorKey).toBeNull(); // not duplicated in the summary
      expect(useRedeemStore.getState().pinOpen).toBe(true);
      expect(useRedeemStore.getState().step).toBe("form");
    });

    test("WALLET_NOT_ACTIVE → summary error, PIN dialog closed", async () => {
      fillForm();
      createMock.mockRejectedValueOnce(new ApiError(409, "WALLET_NOT_ACTIVE", "x"));
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isFormValid).toBe(true));
      act(() => result.current.openPin());
      await act(async () => {
        await result.current.submitRedeem("123456").catch(() => undefined);
      });
      await waitFor(() => expect(result.current.createErrorKey).toBe("redeem.errWalletNotActive"));
      expect(useRedeemStore.getState().pinOpen).toBe(false);
    });

    test("TOO_MANY_ATTEMPTS → PIN cooldown from Retry-After", async () => {
      fillForm();
      createMock.mockRejectedValueOnce(
        new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }, 900),
      );
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isFormValid).toBe(true));
      await act(async () => {
        await result.current.submitRedeem("123456").catch(() => undefined);
      });
      await waitFor(() => expect(result.current.pinCooldownSeconds).toBe(900));
    });

    test("custodial balance below the amount blocks the burn", async () => {
      getWalletMock.mockResolvedValue({ ...WALLET, balance: "10.00" });
      fillForm();
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.effectiveSellRate).toBe(SELL_RATE));
      await waitFor(() => expect(result.current.balanceUsdx).toBe(10));
      await waitFor(() => expect(result.current.insufficientBalance).toBe(true));
      expect(result.current.canBurn).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("switching to the external wallet restores the existing self-sign gate", async () => {
      fillForm();
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.custodialAvailable).toBe(true));
      act(() => result.current.setSource("external"));
      expect(result.current.isCustodialSource).toBe(false);
      expect(result.current.isWalletConnected).toBe(false); // stub: not connected
      expect(result.current.canBurn).toBe(false);
      expect(result.current.walletAddress).toBeUndefined();
    });

    test("no custodial wallet → source is forced external and nothing custodial is offered", () => {
      useAuthStore.setState({ user: { ...USER, custodialWallet: null } });
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      expect(result.current.custodialAvailable).toBe(false);
      expect(result.current.isCustodialSource).toBe(false);
      expect(getWalletMock).not.toHaveBeenCalled();
    });

    test("the backend's burnMode wins: a SELF_SIGN reply on the custodial source still does not report a burn the client never made", async () => {
      // Defensive: FE never decides burnMode. If the backend says SELF_SIGN the
      // existing burn runner is used with the (absent) external wallet — it is
      // gated on the connected address, so nothing is written here either.
      fillForm();
      createMock.mockResolvedValueOnce({ ...ORDER, burnMode: "SELF_SIGN" });
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isFormValid).toBe(true));
      await act(async () => {
        await result.current.submitRedeem("123456");
      });
      expect(useRedeemStore.getState().step).toBe("tracker");
    });

    test("redeemErrorKey leaves PIN codes to the PIN dialog", () => {
      expect(redeemErrorKey(new ApiError(401, "INVALID_PIN", "x"))).toBeNull();
      expect(redeemErrorKey(new ApiError(401, "PIN_NOT_SET", "x"))).toBeNull();
      expect(redeemErrorKey(new ApiError(429, "TOO_MANY_ATTEMPTS", "x"))).toBeNull();
      expect(redeemErrorKey(new ApiError(409, "WALLET_NOT_ACTIVE", "x"))).toBe("redeem.errWalletNotActive");
    });
  });
});
