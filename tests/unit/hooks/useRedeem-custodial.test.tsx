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
vi.mock("@/lib/api/wallet-api", () => ({ getCustodialWallet: vi.fn(), createCustodialWallet: vi.fn() }));

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
  twoFactorEnabled: true,
  custodialWallet: { address: CUSTODIAL, status: "ACTIVE" },
};
const CODE = "492817";
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
        await result.current.submitRedeem("123456", CODE);
      });
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ userAddress: CUSTODIAL, pin: "123456", twoFactorCode: CODE }),
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
        await result.current.submitRedeem("000000", CODE).catch(() => undefined);
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
        await result.current.submitRedeem("123456", CODE).catch(() => undefined);
      });
      await waitFor(() => expect(result.current.createErrorKey).toBe("redeem.errWalletNotActive"));
      expect(useRedeemStore.getState().pinOpen).toBe(false);
      // "tampilkan status wallet, jangan tawarkan retry" (wallet.yaml § 409): the
      // status word is supplied and the confirm button is blocked.
      expect(result.current.walletBlocked).toBe(true);
      expect(result.current.createErrorStatusKey).toBe("wallet.status.notActive");
      // The stale profile copy is re-read so the message can follow reality.
      await waitFor(() => expect(getWalletMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    });

    test("TOO_MANY_ATTEMPTS → PIN cooldown from Retry-After", async () => {
      fillForm();
      createMock.mockRejectedValueOnce(
        new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }, 900),
      );
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isFormValid).toBe(true));
      await act(async () => {
        await result.current.submitRedeem("123456", CODE).catch(() => undefined);
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

  describe("edge case", () => {
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
        await result.current.submitRedeem("123456", CODE);
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

// 2FA wajib di redeem custodial (custodial-wallet.md §6.1, redeem.yaml, USDX-717):
// pola yang sama dengan transfer — kode ikut di body create, galat kode tetap di
// dialog PIN, SETUP_REQUIRED/OUTBOUND_LOCKED ke kartu/banner (bukan kalimat
// Ringkasan), lockout 2fa-stepup punya hitung mundur sendiri. SELF_SIGN tidak berubah.
describe("useRedeem — custodial 2FA step-up", () => {
  async function submitFailing(error: ApiError) {
    fillForm();
    createMock.mockRejectedValueOnce(error);
    const utils = renderHook(() => useRedeem(), { wrapper: createWrapper() });
    await waitFor(() => expect(utils.result.current.isFormValid).toBe(true));
    act(() => utils.result.current.openPin());
    await act(async () => {
      await utils.result.current.submitRedeem("123456", "000000").catch(() => undefined);
    });
    return utils;
  }

  describe("positive", () => {
    test("wrong code → message under the code field, dialog stays open, nothing in the Ringkasan", async () => {
      const { result } = await submitFailing(new ApiError(401, "INVALID_TWO_FACTOR_CODE", "x"));
      await waitFor(() => expect(result.current.twoFactorErrorKey).toBe("stepUp.errInvalid"));
      expect(result.current.createErrorKey).toBeNull();
      expect(result.current.pinErrorKey).toBeNull();
      expect(useRedeemStore.getState().pinOpen).toBe(true);
    });
  });

  describe("negative", () => {
    test("TWO_FACTOR_SETUP_REQUIRED → dialog closes, 2FA card, no Ringkasan error", async () => {
      const { result } = await submitFailing(new ApiError(401, "TWO_FACTOR_SETUP_REQUIRED", "x"));
      await waitFor(() => expect(result.current.twoFactorSetupRequired).toBe(true));
      expect(useRedeemStore.getState().pinOpen).toBe(false);
      expect(result.current.createErrorKey).toBeNull();
    });

    test("409 CUSTODIAL_OUTBOUND_LOCKED → dialog closes, lock banner data, no Ringkasan error", async () => {
      const until = new Date(Date.now() + 3_600_000).toISOString();
      const { result } = await submitFailing(
        new ApiError(409, "CUSTODIAL_OUTBOUND_LOCKED", "x", { lockedUntil: until }),
      );
      await waitFor(() => expect(result.current.outboundLockedUntil).toBe(until));
      expect(useRedeemStore.getState().pinOpen).toBe(false);
      expect(result.current.createErrorKey).toBeNull();
    });
  });

  describe("edge case", () => {
    test("429 scope 2fa-stepup → code countdown, PIN countdown untouched, dialog open", async () => {
      const { result } = await submitFailing(
        new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { scope: "2fa-stepup" }, 900),
      );
      await waitFor(() => expect(result.current.twoFactorCooldownSeconds).toBe(900));
      expect(result.current.pinCooldownSeconds).toBe(0);
      expect(useRedeemStore.getState().pinOpen).toBe(true);
    });

    test("the external source never sends a code and ignores the 2FA guard", async () => {
      useAuthStore.setState({ user: { ...USER, twoFactorEnabled: false } });
      const { result } = renderHook(() => useRedeem(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.custodialAvailable).toBe(true));
      expect(result.current.twoFactorSetupRequired).toBe(true);
      act(() => result.current.setSource("external"));
      expect(result.current.twoFactorSetupRequired).toBe(false);
    });

    test("redeemErrorKey leaves 2FA codes to the dialog and the guard", () => {
      expect(redeemErrorKey(new ApiError(401, "INVALID_TWO_FACTOR_CODE", "x"))).toBeNull();
      expect(redeemErrorKey(new ApiError(401, "TWO_FACTOR_CODE_REQUIRED", "x"))).toBeNull();
      expect(redeemErrorKey(new ApiError(401, "TWO_FACTOR_SETUP_REQUIRED", "x"))).toBeNull();
      expect(redeemErrorKey(new ApiError(409, "CUSTODIAL_OUTBOUND_LOCKED", "x"))).toBeNull();
    });
  });
});
