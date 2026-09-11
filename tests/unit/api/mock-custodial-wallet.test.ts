import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mockCreateCustodialWallet,
  mockGetCustodialWallet,
  mockGetMe,
  mockLogin,
  resetMockCustodialWallet,
  MOCK_CUSTODIAL_ADDRESS,
  MOCK_PROVISIONING_MS,
  type MockCustodialState,
} from "@/lib/api/mock-api";

// The mock persists its wallet in localStorage ("usdx-mock-custodial") so the
// Playwright flows survive page loads. jsdom gives every test the same store,
// so each one starts from "no wallet".
const SEAM_KEY = "usdx-mock-custodial";

function seed(state: Partial<MockCustodialState> & { status: MockCustodialState["status"] }) {
  const full: MockCustodialState = {
    address: state.status === "PROVISIONING" ? null : MOCK_CUSTODIAL_ADDRESS,
    createdAt: "2026-09-11T00:00:00.000Z",
    activateAt: null,
    balance: state.status === "PROVISIONING" ? null : "0.00",
    ...state,
  };
  localStorage.setItem(SEAM_KEY, JSON.stringify(full));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetMockCustodialWallet();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mock custodial wallet", () => {
  describe("positive", () => {
    test("create → 202-shaped PROVISIONING with address null and no balance", async () => {
      const wallet = await mockCreateCustodialWallet();

      expect(wallet.status).toBe("PROVISIONING");
      expect(wallet.address).toBeNull();
      expect(wallet.balance).toBeNull();
      expect(wallet.balanceWei).toBeNull();
      expect(wallet.balanceAt).toBeNull();
      expect(wallet.chain).toBe("polygon");
    });

    test("GET flips PROVISIONING → ACTIVE once the provisioning delay has passed", async () => {
      await mockCreateCustodialWallet();

      const early = await mockGetCustodialWallet();
      expect(early.status).toBe("PROVISIONING");

      vi.advanceTimersByTime(MOCK_PROVISIONING_MS + 1);
      const late = await mockGetCustodialWallet();
      expect(late.status).toBe("ACTIVE");
      expect(late.address).toBe(MOCK_CUSTODIAL_ADDRESS);
      // A fresh wallet holds 0 — a real zero, readable, not "unknown".
      expect(late.balance).toBe("0.00");
      expect(late.balanceWei).toBe("0");
      expect(late.balanceAt).not.toBeNull();
    });

    test("the summary rides along on /auth/me and login (users.yaml § custodialWallet)", async () => {
      expect((await mockGetMe()).custodialWallet).toBeNull();

      seed({ status: "ACTIVE", balance: "12.00" });

      expect((await mockGetMe()).custodialWallet).toEqual({
        address: MOCK_CUSTODIAL_ADDRESS,
        status: "ACTIVE",
      });
      const session = await mockLogin({ email: "demo@usdx.com", password: "Demo1234" });
      expect(session.user.custodialWallet?.status).toBe("ACTIVE");
    });
  });

  describe("negative", () => {
    test("GET without a wallet → 404 WALLET_NOT_FOUND", async () => {
      await expect(mockGetCustodialWallet()).rejects.toMatchObject({
        status: 404,
        code: "WALLET_NOT_FOUND",
      });
    });

    test("create when ACTIVE → 409 WALLET_ALREADY_EXISTS; when SUSPENDED → 409 WALLET_SUSPENDED", async () => {
      seed({ status: "ACTIVE" });
      await expect(mockCreateCustodialWallet()).rejects.toMatchObject({
        status: 409,
        code: "WALLET_ALREADY_EXISTS",
      });

      seed({ status: "SUSPENDED" });
      await expect(mockCreateCustodialWallet()).rejects.toMatchObject({
        status: 409,
        code: "WALLET_SUSPENDED",
      });
    });

    test("failNextCreate seam → one 503, then the next create goes through", async () => {
      seed({ status: "PROVISIONING", failNextCreate: true, stuck: true });

      await expect(mockCreateCustodialWallet()).rejects.toMatchObject({
        status: 503,
        code: "WALLET_SERVICE_UNAVAILABLE",
      });
      await expect(mockCreateCustodialWallet()).resolves.toMatchObject({ status: "PROVISIONING" });
    });
  });

  describe("edge cases", () => {
    test("a stuck wallet never activates on GET, and a repeat POST (retry) heals it", async () => {
      seed({ status: "PROVISIONING", stuck: true });

      vi.advanceTimersByTime(MOCK_PROVISIONING_MS * 10);
      expect((await mockGetCustodialWallet()).status).toBe("PROVISIONING");

      // Retry = POST again → 202 with the same state, not 409 — and it is the
      // thing that refreshes the working copy (custodial-wallet.md §5.5).
      const again = await mockCreateCustodialWallet();
      expect(again.status).toBe("PROVISIONING");

      vi.advanceTimersByTime(MOCK_PROVISIONING_MS + 1);
      expect((await mockGetCustodialWallet()).status).toBe("ACTIVE");
    });

    test("balance null on an ACTIVE wallet stays null (RPC unreadable), never 0", async () => {
      seed({ status: "ACTIVE", balance: null });

      const wallet = await mockGetCustodialWallet();
      expect(wallet.status).toBe("ACTIVE");
      expect(wallet.balance).toBeNull();
      expect(wallet.balanceWei).toBeNull();
    });

    test("balance is reported with 6 on-chain decimals in balanceWei", async () => {
      seed({ status: "ACTIVE", balance: "125.50" });

      const wallet = await mockGetCustodialWallet();
      expect(wallet.balance).toBe("125.50");
      expect(wallet.balanceWei).toBe("125500000");
    });
  });
});
