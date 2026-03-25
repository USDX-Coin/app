import { describe, test, expect } from "vitest";
import {
  mockLogin,
  mockRegister,
  mockGetTransactions,
  mockCreateMint,
  mockCreateRedeem,
  mockGetBankAccounts,
  mockGetWalletBalance,
} from "@/lib/api/mock-api";

describe("mockLogin", () => {
  describe("positive", () => {
    test("returns user and token for valid credentials", async () => {
      const result = await mockLogin({
        email: "demo@usdx.com",
        password: "Demo1234",
      });
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe("demo@usdx.com");
      expect(result.token).toContain("mock-jwt-token");
    });
  });

  describe("negative", () => {
    test("throws error for wrong password", async () => {
      await expect(
        mockLogin({ email: "demo@usdx.com", password: "wrong" })
      ).rejects.toThrow("Invalid email or password");
    });

    test("throws error for non-existent email", async () => {
      await expect(
        mockLogin({ email: "nobody@test.com", password: "Demo1234" })
      ).rejects.toThrow("Invalid email or password");
    });
  });

  describe("edge cases", () => {
    test("credentials are case-sensitive", async () => {
      await expect(
        mockLogin({ email: "Demo@usdx.com", password: "Demo1234" })
      ).rejects.toThrow();
    });
  });
});

describe("mockRegister", () => {
  describe("positive", () => {
    test("creates new user and returns auth response", async () => {
      const result = await mockRegister({
        fullName: "Test User",
        email: `test-${Date.now()}@test.com`,
        password: "TestPass1",
      });
      expect(result.user).toBeDefined();
      expect(result.user.fullName).toBe("Test User");
      expect(result.token).toContain("mock-jwt-token");
    });
  });

  describe("negative", () => {
    test("throws error for duplicate email", async () => {
      await expect(
        mockRegister({
          fullName: "Dup",
          email: "demo@usdx.com",
          password: "Pass1234",
        })
      ).rejects.toThrow("Email already registered");
    });
  });
});

describe("mockCreateMint", () => {
  describe("positive", () => {
    test("returns MintOrder with correct fee calculation", async () => {
      const result = await mockCreateMint({
        chainId: "base",
        amount: 1000,
        destinationAddress: "0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(result.amount).toBe(1000);
      expect(result.fee).toBeCloseTo(7, 2);
      expect(result.status).toBe("pending");
      expect(result.id).toContain("mint_");
    });
  });

  describe("edge cases", () => {
    test("generates unique order ID", async () => {
      const r1 = await mockCreateMint({
        chainId: "base",
        amount: 100,
        destinationAddress: "0x1234567890abcdef1234567890abcdef12345678",
      });
      const r2 = await mockCreateMint({
        chainId: "base",
        amount: 100,
        destinationAddress: "0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(r1.id).not.toBe(r2.id);
    });
  });
});

describe("mockCreateRedeem", () => {
  describe("positive", () => {
    test("returns RedeemOrder with correct receive amount", async () => {
      const result = await mockCreateRedeem({
        chainId: "base",
        amount: 1000,
        bankAccountId: "bank_1",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(result.amount).toBe(1000);
      expect(result.fee).toBeCloseTo(7, 2);
      expect(result.totalReceiveUsd).toBeCloseTo(993, 0);
      expect(result.txHash).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    test("receive amount = amount - fee", async () => {
      const result = await mockCreateRedeem({
        chainId: "polygon",
        amount: 500,
        bankAccountId: "bank_1",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(result.totalReceiveUsd).toBeCloseTo(
        result.amount - result.fee,
        2
      );
    });
  });
});

describe("mockGetTransactions", () => {
  describe("positive", () => {
    test("returns array of transactions", async () => {
      const txs = await mockGetTransactions();
      expect(Array.isArray(txs)).toBe(true);
      expect(txs.length).toBe(10);
    });

    test("each transaction has required fields", async () => {
      const txs = await mockGetTransactions();
      for (const tx of txs) {
        expect(tx.id).toBeTruthy();
        expect(["mint", "redeem"]).toContain(tx.type);
        expect(tx.amount).toBeGreaterThan(0);
        expect(tx.chainId).toBeTruthy();
        expect(["completed", "pending", "failed"]).toContain(tx.status);
        expect(tx.txHash).toBeTruthy();
        expect(tx.createdAt).toBeTruthy();
      }
    });
  });
});

describe("mockGetBankAccounts", () => {
  describe("positive", () => {
    test("returns bank accounts with masked numbers", async () => {
      const accounts = await mockGetBankAccounts();
      expect(accounts).toHaveLength(2);
      for (const account of accounts) {
        expect(account.accountNumber).toContain("****");
      }
    });
  });
});

describe("mockGetWalletBalance", () => {
  describe("positive", () => {
    test("returns consistent balance", async () => {
      const balance = await mockGetWalletBalance();
      expect(balance).toBe(5000);
    });
  });
});
