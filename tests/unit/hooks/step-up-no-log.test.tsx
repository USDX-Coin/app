import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useTransfer } from "@/hooks/useTransfer";
import { useTransferStore } from "@/stores/transferStore";
import { useAuthStore } from "@/stores/authStore";
import {
  MOCK_CUSTODIAL_ADDRESS,
  resetMockCustodialWallet,
  seedMockCustodialWallet,
} from "@/lib/api/mock-custodial-wallet";
import { MOCK_PIN } from "@/lib/api/mock-pin";
import {
  MOCK_BACKUP_CODES,
  MOCK_TOTP_CODE,
  resetMockTwoFactor,
  seedMockTwoFactor,
} from "@/lib/api/mock-two-factor";
import type { User } from "@/types";

// AC USDX-717 (custodial-wallet.md §6.1 "Log"): the authenticator / backup code sent
// with a custodial transfer never reaches the client's log — on success, on a wrong
// code, on the lockout, and on the one path that does log (IDEMPOTENCY_KEY_REUSED).
// The client has no analytics SDK; `console.*` is its only log. Runs against the
// mock backend (env.useMock in unit tests).
const METHODS = ["log", "info", "warn", "error", "debug"] as const;
const SECRETS = [MOCK_TOTP_CODE, MOCK_BACKUP_CODES[0], "000000"];
const TO = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const t = (key: string) => key;
let spies: ReturnType<typeof vi.spyOn>[] = [];

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
  custodialWallet: { address: MOCK_CUSTODIAL_ADDRESS, status: "ACTIVE" },
};

function expectNoSecretLogged() {
  const text = spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => (typeof arg === "string" ? arg : (JSON.stringify(arg) ?? String(arg))))
    .join("\n");
  for (const secret of SECRETS) expect(text).not.toContain(secret);
}

async function renderReady() {
  const utils = renderHook(() => useTransfer(t), { wrapper: createWrapper() });
  await waitFor(() => expect(utils.result.current.balanceUsdx).toBe(1000));
  useTransferStore.getState().setTo(TO);
  useTransferStore.getState().setAmount("5");
  return utils;
}

beforeEach(() => {
  localStorage.clear();
  resetMockCustodialWallet();
  resetMockTwoFactor();
  seedMockCustodialWallet();
  seedMockTwoFactor(true);
  useTransferStore.getState().reset();
  useAuthStore.setState({ user: USER, isAuthenticated: true, token: "t" });
  spies = METHODS.map((m) => vi.spyOn(console, m));
});

afterEach(() => {
  spies.forEach((s) => s.mockRestore());
});

describe("custodial transfer — the 2FA code never reaches the log", () => {
  describe("positive", () => {
    test("a transfer approved with the authenticator code, then one with a backup code", async () => {
      const { result } = await renderReady();
      await act(async () => {
        await result.current.submitWithPin(MOCK_PIN, MOCK_TOTP_CODE);
      });
      await waitFor(() => expect(useTransferStore.getState().step).toBe("done"));
      act(() => result.current.reset());
      useTransferStore.getState().setTo(TO);
      useTransferStore.getState().setAmount("6");
      await act(async () => {
        await result.current.submitWithPin(MOCK_PIN, MOCK_BACKUP_CODES[0]);
      });
      await waitFor(() => expect(useTransferStore.getState().step).toBe("done"));
      expectNoSecretLogged();
    }, 10_000);
  });

  describe("negative", () => {
    test("wrong codes up to the 2fa-stepup lockout", async () => {
      const { result } = await renderReady();
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          await result.current.submitWithPin(MOCK_PIN, "000000");
        });
      }
      await waitFor(() => expect(result.current.twoFactorCooldownSeconds).toBeGreaterThan(0));
      expectNoSecretLogged();
    }, 10_000);
  });

  describe("edge case", () => {
    test("IDEMPOTENCY_KEY_REUSED — the path that console.errors — does not carry the code", async () => {
      const { result } = await renderReady();
      const key = useTransferStore.getState().ensureIdempotencyKey();
      await act(async () => {
        await result.current.submitWithPin(MOCK_PIN, MOCK_TOTP_CODE);
      });
      // Same key, different body = the FE bug the contract answers with 409 REUSED.
      act(() => result.current.reset());
      useTransferStore.setState({ to: TO, amount: "7", idempotencyKey: key });
      await act(async () => {
        await result.current.submitWithPin(MOCK_PIN, MOCK_TOTP_CODE);
      });
      await waitFor(() => expect(spies[3]).toHaveBeenCalled());
      expectNoSecretLogged();
    }, 10_000);
  });
});
