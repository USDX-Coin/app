import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper, createCachingWrapper } from "../../helpers/test-utils";
import { useTransfer, mapTransferError } from "@/hooks/useTransfer";
import { useSession } from "@/hooks/useSession";
import { useTransferStore } from "@/stores/transferStore";
import { useAuthStore } from "@/stores/authStore";
import { getCustodialWallet, transferCustodial } from "@/lib/api/wallet-api";
import { getMe } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/client";
import type { CustodialWallet, TransferAccepted, User } from "@/types";

vi.mock("@/lib/api/wallet-api", () => ({
  getCustodialWallet: vi.fn(),
  createCustodialWallet: vi.fn(),
  transferCustodial: vi.fn(),
}));
const getWalletMock = vi.mocked(getCustodialWallet);
const transferMock = vi.mocked(transferCustodial);
vi.mock("@/lib/api/auth-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth-api")>()),
  getMe: vi.fn(),
}));
const getMeMock = vi.mocked(getMe);

const OWN = "0x000000C528aE908fB929a0898B65e913623c9aFf";
const TO = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const t = (key: string) => key;

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
  custodialWallet: { address: OWN, status: "ACTIVE" },
};
const WALLET: CustodialWallet = {
  address: OWN,
  status: "ACTIVE",
  chain: "polygon",
  contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
  balance: "100.00",
  balanceWei: "100000000",
  balanceAt: "2026-08-28T04:12:31.000Z",
  createdAt: "2026-08-28T04:10:00.000Z",
};
const ACCEPTED: TransferAccepted = {
  id: "0193abce-11aa-7bcd-8e01-5c2f0a9d4e77",
  txHash: "0x" + "ab".repeat(32),
  from: OWN,
  to: TO,
  amount: "25.00",
  amountWei: "25000000",
  chain: "polygon",
  submittedAt: "2026-08-28T04:20:11.000Z",
};

function fillValidForm() {
  const s = useTransferStore.getState();
  s.setTo(TO);
  s.setAmount("25");
}

async function renderReady() {
  const utils = renderHook(() => useTransfer(t), { wrapper: createWrapper() });
  await waitFor(() => expect(utils.result.current.balanceUsdx).toBe(100));
  return utils;
}

beforeEach(() => {
  useTransferStore.getState().reset();
  useAuthStore.setState({ user: USER, isAuthenticated: true, token: "t" });
  getWalletMock.mockReset();
  getWalletMock.mockResolvedValue(WALLET);
  transferMock.mockReset();
  transferMock.mockResolvedValue(ACCEPTED);
  getMeMock.mockReset();
});

describe("useTransfer", () => {
  describe("validation", () => {
    describe("positive", () => {
      test("valid destination + amount within balance → isFormValid", async () => {
        fillValidForm();
        const { result } = await renderReady();
        expect(result.current.addressError).toBeNull();
        expect(result.current.amountError).toBeNull();
        expect(result.current.isFormValid).toBe(true);
      });
    });

    describe("negative", () => {
      test("own custodial address is rejected as a destination", async () => {
        useTransferStore.getState().setTo(OWN.toLowerCase());
        const { result } = await renderReady();
        expect(result.current.addressError).toBe("validation.address.own");
        expect(result.current.isFormValid).toBe(false);
      });

      test("amount above the known balance is rejected", async () => {
        useTransferStore.getState().setTo(TO);
        useTransferStore.getState().setAmount("100.01");
        const { result } = await renderReady();
        expect(result.current.amountError).toBe("validation.amount.insufficient");
      });

      test("no custodial wallet → never valid, nothing to send from", () => {
        useAuthStore.setState({ user: { ...USER, custodialWallet: null } });
        fillValidForm();
        const { result } = renderHook(() => useTransfer(t), { wrapper: createWrapper() });
        expect(result.current.isWalletActive).toBe(false);
        expect(result.current.isFormValid).toBe(false);
      });
    });

    describe("edge case", () => {
      test("setMaxAmount fills the known balance; does nothing when unknown", async () => {
        const { result } = await renderReady();
        act(() => result.current.setMaxAmount());
        expect(useTransferStore.getState().amount).toBe("100");
      });
    });
  });

  describe("submit", () => {
    describe("positive", () => {
      test("PIN submit sends body + a v7 Idempotency-Key, then shows the result", async () => {
        fillValidForm();
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        expect(transferMock).toHaveBeenCalledTimes(1);
        const [body, key] = transferMock.mock.calls[0];
        expect(body).toEqual({ to: TO, amount: "25", pin: "123456" });
        expect(key).toMatch(UUID);
        const s = useTransferStore.getState();
        expect(s.step).toBe("done");
        expect(s.result).toEqual(ACCEPTED);
        expect(s.idempotencyKey).toBeNull(); // intent finished
      });

      test("the wallet balance is re-read after a broadcast", async () => {
        fillValidForm();
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        await waitFor(() => expect(getWalletMock.mock.calls.length).toBeGreaterThanOrEqual(2));
      });
    });

    describe("negative", () => {
      test("wrong PIN → error stays in the PIN dialog and the SAME key is reused", async () => {
        fillValidForm();
        transferMock.mockRejectedValueOnce(new ApiError(401, "INVALID_PIN", "PIN salah"));
        const { result } = await renderReady();
        act(() => result.current.openPin());
        await act(async () => {
          await result.current.submitWithPin("000000");
        });
        await waitFor(() => expect(result.current.pinErrorKey).toBe("pin.errInvalid"));
        expect(result.current.formErrorKey).toBeNull();
        expect(useTransferStore.getState().pinOpen).toBe(true);
        const firstKey = transferMock.mock.calls[0][1];

        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        expect(transferMock.mock.calls[1][1]).toBe(firstKey);
        expect(useTransferStore.getState().step).toBe("done");
      });

      test("WALLET_NOT_ACTIVE → form error with the wallet status, no retry offered", async () => {
        fillValidForm();
        transferMock.mockRejectedValueOnce(new ApiError(409, "WALLET_NOT_ACTIVE", "x"));
        const { result } = await renderReady();
        act(() => result.current.openPin());
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        await waitFor(() => expect(result.current.formErrorKey).toBe("transfer.errWalletNotActive"));
        expect(result.current.formErrorVars).toEqual({ status: "wallet.status.notActive" });
        expect(result.current.walletBlocked).toBe(true);
        expect(useTransferStore.getState().pinOpen).toBe(false); // message shows in the summary
      });

      test("TRANSFER_LIMIT_EXCEEDED DAILY → specific message with the limit figures", async () => {
        fillValidForm();
        transferMock.mockRejectedValueOnce(
          new ApiError(422, "TRANSFER_LIMIT_EXCEEDED", "x", {
            limitType: "DAILY",
            limit: "5000.00",
            remaining: "120.00",
            resetAt: "2026-08-29T00:00:00.000Z",
          }),
        );
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        await waitFor(() => expect(result.current.formErrorKey).toBe("transfer.errLimitDaily"));
        expect(result.current.formErrorVars).toMatchObject({ limit: "5,000", remaining: "120" });
        // resetAt is rendered with the app's locale + date, not the browser default.
        expect(result.current.formErrorVars?.resetAt).toMatch(/2026/);
      });

      test("TOO_MANY_ATTEMPTS → PIN cooldown runs from Retry-After", async () => {
        fillValidForm();
        transferMock.mockRejectedValueOnce(
          new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }, 900),
        );
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        await waitFor(() => expect(result.current.pinCooldownSeconds).toBe(900));
        expect(result.current.pinErrorKey).toBeNull(); // the countdown is the message
      });

      test("PIN_NOT_SET → the dialog switches to the 'set a PIN first' state", async () => {
        fillValidForm();
        transferMock.mockRejectedValueOnce(new ApiError(401, "PIN_NOT_SET", "x"));
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        await waitFor(() => expect(result.current.pinNotSet).toBe(true));
      });

      test("PIN_NOT_SET → a cached /auth/me saying true does not bring the PIN back when Settings reopens", async () => {
        // Settings (useSession) cached /auth/me with pinSet true, then the user left
        // for /send, which does not mount useSession (custodial-wallet.md §5.1).
        const wrapper = createCachingWrapper();
        getMeMock.mockResolvedValueOnce(USER);
        const settings = renderHook(() => useSession(), { wrapper });
        await waitFor(() => expect(settings.result.current.data).toBeTruthy());
        settings.unmount();

        fillValidForm();
        transferMock.mockRejectedValueOnce(new ApiError(401, "PIN_NOT_SET", "x"));
        const { result } = renderHook(() => useTransfer(t), { wrapper });
        await waitFor(() => expect(result.current.balanceUsdx).toBe(100));
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        await waitFor(() => expect(useAuthStore.getState().user?.pinSet).toBe(false));

        getMeMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        const again = renderHook(() => useSession(), { wrapper });
        await waitFor(() => expect(again.result.current.isFetching).toBe(false));
        expect(useAuthStore.getState().user?.pinSet).toBe(false);
      });
    });

    describe("edge case", () => {
      test(
        "IDEMPOTENCY_KEY_IN_PROGRESS → waits and retries with the SAME key, never a new one",
        async () => {
          fillValidForm();
          transferMock
            .mockRejectedValueOnce(new ApiError(409, "IDEMPOTENCY_KEY_IN_PROGRESS", "x"))
            .mockResolvedValueOnce(ACCEPTED);
          const { result } = await renderReady();
          await act(async () => {
            await result.current.submitWithPin("123456");
          });
          expect(transferMock).toHaveBeenCalledTimes(2);
          expect(transferMock.mock.calls[1][1]).toBe(transferMock.mock.calls[0][1]);
          expect(useTransferStore.getState().step).toBe("done");
        },
        10_000,
      );

      test("a lost 202 then a 200 replay with the same key lands on the SAME tracker id (USDX-701)", async () => {
        fillValidForm();
        // First attempt: broadcast happened but the answer never arrived (network drop).
        transferMock
          .mockRejectedValueOnce(new TypeError("Failed to fetch"))
          .mockResolvedValueOnce({ ...ACCEPTED }); // 200 replay — identical, same id
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        expect(useTransferStore.getState().step).toBe("form");

        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        expect(transferMock.mock.calls[1][1]).toBe(transferMock.mock.calls[0][1]);
        const s = useTransferStore.getState();
        expect(s.step).toBe("done");
        expect(s.result?.id).toBe(ACCEPTED.id);
      });

      test("IDEMPOTENCY_KEY_REUSED (FE bug) → key dropped, generic message", async () => {
        fillValidForm();
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        transferMock.mockRejectedValueOnce(new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "x"));
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        await waitFor(() => expect(result.current.formErrorKey).toBe("transfer.errGeneric"));
        expect(useTransferStore.getState().idempotencyKey).toBeNull();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      });

      test("the amount is sent in the contract's shape (\"25.\" → \"25\", \"007.50\" → \"7.5\")", async () => {
        useTransferStore.getState().setTo(TO);
        useTransferStore.getState().setAmount("007.50");
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        expect(transferMock.mock.calls[0][0].amount).toBe("7.5");
      });

      test("RATE_LIMITED (global toast) leaves the PIN dialog open for a same-key retry", async () => {
        fillValidForm();
        transferMock.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "x", undefined, 1));
        const { result } = await renderReady();
        act(() => result.current.openPin());
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        expect(useTransferStore.getState().pinOpen).toBe(true);
        expect(result.current.formErrorKey).toBeNull();
        const firstKey = transferMock.mock.calls[0][1];
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        expect(transferMock.mock.calls[1][1]).toBe(firstKey);
      });

      test("changing the amount after a failure starts a new intent (new key)", async () => {
        fillValidForm();
        transferMock.mockRejectedValueOnce(new ApiError(503, "WALLET_SERVICE_UNAVAILABLE", "x"));
        const { result } = await renderReady();
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        await waitFor(() => expect(result.current.formErrorKey).toBe("transfer.errServiceUnavailable"));
        const firstKey = transferMock.mock.calls[0][1];
        act(() => result.current.setAmount("26"));
        await act(async () => {
          await result.current.submitWithPin("123456");
        });
        expect(transferMock.mock.calls[1][1]).not.toBe(firstKey);
      });
    });
  });

  describe("mapTransferError", () => {
    describe("positive", () => {
      test("every contract code lands on its own sentence and location", () => {
        expect(mapTransferError(new ApiError(401, "INVALID_PIN", "x"), t, "ACTIVE")).toEqual({ where: "pin", key: "pin.errInvalid" });
        expect(mapTransferError(new ApiError(422, "RECIPIENT_BLACKLISTED", "x"), t, "ACTIVE")?.key).toBe("transfer.errBlacklisted");
        expect(mapTransferError(new ApiError(422, "INSUFFICIENT_BALANCE", "x"), t, "ACTIVE")?.key).toBe("transfer.errInsufficient");
        expect(mapTransferError(new ApiError(503, "WALLET_SERVICE_UNAVAILABLE", "x"), t, "ACTIVE")?.key).toBe("transfer.errServiceUnavailable");
        expect(mapTransferError(new ApiError(403, "KYC_NOT_VERIFIED", "x"), t, "ACTIVE")?.key).toBe("transfer.errGate");
      });

      test("SUSPENDED / PROVISIONING wallets are named by status", () => {
        expect(mapTransferError(new ApiError(409, "WALLET_NOT_ACTIVE", "x"), t, "SUSPENDED")?.vars).toEqual({
          status: "wallet.status.SUSPENDED",
        });
        expect(mapTransferError(new ApiError(409, "WALLET_NOT_ACTIVE", "x"), t, "PROVISIONING")?.vars).toEqual({
          status: "wallet.status.PROVISIONING",
        });
      });
    });

    describe("negative", () => {
      test("RATE_LIMITED is left to the global toast (null)", () => {
        expect(mapTransferError(new ApiError(429, "RATE_LIMITED", "x"), t, "ACTIVE")).toBeNull();
      });

      test("network failure → error.offline; 5xx → error.server", () => {
        expect(mapTransferError(new TypeError("Failed to fetch"), t, "ACTIVE")?.key).toBe("error.offline");
        expect(mapTransferError(new ApiError(500, "INTERNAL", "x"), t, "ACTIVE")?.key).toBe("error.server");
      });
    });

    describe("edge case", () => {
      test("a stale ACTIVE profile copy still gets a status word, not an empty bracket", () => {
        expect(mapTransferError(new ApiError(409, "WALLET_NOT_ACTIVE", "x"), t, "ACTIVE")?.vars).toEqual({
          status: "wallet.status.notActive",
        });
      });

      test("TRANSFER_LIMIT_EXCEEDED with malformed details still names a limit, not undefined", () => {
        expect(mapTransferError(new ApiError(422, "TRANSFER_LIMIT_EXCEEDED", "x"), t, "ACTIVE")).toEqual({
          where: "form",
          key: "transfer.errLimitGeneric",
        });
      });
    });
  });
});
